// Client-side application logic for ADM Results
import {
  createInitialState,
  createRunConfig,
  createParameterStructure,
  encodeStateToURL,
  decodeStateFromURL,
  loadManifest,
  fetchRunData,
  resolveParametersToRun,
  KDMAUtils,
  toggleParameterLink,
  propagateParameterToAllRuns,
  getParameterValueFromRun,
  isParameterLinked,
  isResultParameter,
  PARAMETER_PRIORITY_ORDER,
  API_TO_APP,
  APP_TO_API
} from './state.js';

import {
  formatValue,
  compareValues,
  getMaxKDMAsForRun,
  getMinimumRequiredKDMAs,
  getValidKDMAsForRun
} from './table-formatter.js';


// Generic function to preserve linked parameters after validation
// Takes snake_case params from API and returns mixed camelCase/snake_case for internal use
function preserveLinkedParameters(validatedSnakeParams, originalCamelParams, appState, changedParamCamel) {
  // Start with the validated params from API (in snake_case)
  const preserved = { ...validatedSnakeParams };
  
  // Convert changed param to snake_case for priority checking
  const changedParamSnake = APP_TO_API[changedParamCamel] || changedParamCamel;
  const changedIndex = PARAMETER_PRIORITY_ORDER.indexOf(changedParamSnake);
  
  // Only preserve linked parameters that are HIGHER priority than the changed parameter
  PARAMETER_PRIORITY_ORDER.forEach((snakeParam, paramIndex) => {
    const camelParam = API_TO_APP[snakeParam];
    
    if (camelParam && isParameterLinked(camelParam, appState)) {
      // Only preserve if this parameter has higher priority (lower index) than changed parameter
      // OR if it's the same parameter (to prevent it from being reset)
      if (paramIndex <= changedIndex) {
        // Get the original value using the camelCase key from originalCamelParams
        preserved[snakeParam] = originalCamelParams[camelParam];
      }
      // Lower priority linked parameters will use the validated values
    }
  });
  
  // Convert back to camelCase format for internal use
  const result = {};
  Object.entries(APP_TO_API).forEach(([camelKey, snakeKey]) => {
    result[camelKey] = preserved[snakeKey];
  });
  return result;
}

// CSV Download functionality
function downloadCSV() {
  const csvPath = './data/experiment_data.csv';
  const link = document.createElement('a');
  link.href = csvPath;
  link.download = 'experiment_data.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

document.addEventListener("DOMContentLoaded", () => {
  
  // UI state persistence for expandable content
  const expandableStates = {
    text: new Map(), // parameterName -> isExpanded
    objects: new Map() // parameterName -> isExpanded
  };
  
  // Expose to global window for table-formatter.js access
  window.expandableStates = expandableStates;
  
  // Central application state initialized with functional state
  let appState = {
    ...createInitialState()
  };

  // Standalone function to create run config from parameters
  function createRunConfigFromParams(params) {
    // Get context-specific available options using updateAppParameters with the run's parameters
    let availableKDMAs = [];
    let enhancedParams = { ...params };
    
    if (window.updateAppParameters) {
      const result = window.updateAppParameters({
        scenario: params.scenario,
        scene: params.scene,
        kdma_values: params.kdmaValues || {},
        adm: params.admType,
        llm: params.llmBackbone,
        run_variant: params.runVariant
      }, {});
      
      availableKDMAs = result.options.kdma_values || [];
      
      // Add all available options to params if they weren't provided
      enhancedParams = {
        ...params,
        availableScenarios: params.availableScenarios || result.options.scenario || [],
        availableScenes: params.availableScenes || result.options.scene || [],
        availableAdmTypes: params.availableAdmTypes || result.options.adm || [],
        availableLLMs: params.availableLLMs || result.options.llm || []
      };
    }
    
    return createRunConfig(enhancedParams, availableKDMAs);
  }

  
  // Parameter storage by run ID 
  const columnParameters = new Map();
  
  // Get parameters for any run ID
  function getParametersForRun(runId) {
    if (!columnParameters.has(runId)) {
      // Initialize with default parameters using auto-correction
      let defaultParams;
      
      // For pinned runs, initialize with the run's actual parameters
      const run = appState.pinnedRuns.get(runId);
      if (run) {
        defaultParams = createParameterStructure({
          scenario: run.scenario,
          scene: run.scene,
          admType: run.admType,
          llmBackbone: run.llmBackbone,
          kdmaValues: run.kdmaValues
        });
      }
      columnParameters.set(runId, defaultParams);
    }
    
    return columnParameters.get(runId);
  }
  
  // Sync functionality - create callback object for imported functions
  const syncCallbacks = {
    renderTable: () => renderComparisonTable(),
    updateURL: () => urlState.updateURL(),
    updateParameterForRun: updateParameterForRun,
    reloadPinnedRun: reloadPinnedRun
  };
  
  window.toggleParameterLink = (paramName) => {
    const result = toggleParameterLink(paramName, appState, syncCallbacks);
    
    // Trigger async reloads if needed (fire-and-forget when enabling a link)
    if (result && result.needsReload && result.runIdsToReload && result.runIdsToReload.length > 0) {
      result.runIdsToReload.forEach(runId => {
        reloadPinnedRun(runId).catch(error => {
          console.error(`Error reloading run ${runId} after parameter link toggle:`, error);
        });
      });
    }
  };
  window.getParameterValueFromRun = getParameterValueFromRun;
  window.propagateParameterToAllRuns = (paramName, value, sourceRunId) => 
    propagateParameterToAllRuns(paramName, value, sourceRunId, appState, syncCallbacks);
  window.appState = appState;

  // Update a parameter for any run with validation and UI sync
  function updateParameterForRun(runId, paramType, newValue, isPropagatedUpdate = false) {
    const params = getParametersForRun(runId);
    const run = appState.pinnedRuns.get(runId);
    
    // Update the parameter directly since we're using camelCase consistently
    params[paramType] = newValue;
    
    // Always call updateAppParameters to get updated options
    const stateParams = {
      scenario: params.scenario || null,
      scene: params.scene || null,
      kdma_values: params.kdmaValues || {},
      adm: params.admType || null,
      llm: params.llmBackbone || null,
      run_variant: params.runVariant || null
    };
    
    const result = window.updateAppParameters(stateParams, {});
    const validParams = result.params;
    const validOptions = result.options;
    
    // For propagated updates of linked parameters, we need to validate and cascade lower priority params
    if (isPropagatedUpdate && isParameterLinked(paramType, appState)) {
      // Use the special preserveLinkedParameters that respects priority hierarchy
      // Pass the API params directly (snake_case) and original params (camelCase)
      const finalParams = preserveLinkedParameters(validParams, params, appState, paramType);
      
      // Store the parameters with proper cascading
      columnParameters.set(runId, createParameterStructure(finalParams));
      
      // Update the actual run state
      run.scenario = finalParams.scenario;
      run.scene = finalParams.scene;
      run.admType = finalParams.admType;
      run.llmBackbone = finalParams.llmBackbone;
      run.runVariant = finalParams.runVariant;
      run.kdmaValues = finalParams.kdmaValues;
      
      // Store the updated available options for UI dropdowns
      run.availableOptions = {
        scenarios: validOptions.scenario || [],
        scenes: validOptions.scene || [],
        admTypes: validOptions.adm || [],
        llms: validOptions.llm || [],
        runVariants: validOptions.run_variant || [],
        kdmaValues: {
          validCombinations: validOptions.kdma_values || []
        }
      };
      
      return finalParams; // Return the params with proper cascading
    }
    
    // For direct user updates (including on linked parameters), always validate for proper cascading
    // This ensures the source column gets valid parameter combinations
    
    // Preserve any linked parameters - they should not be changed by validation
    // Pass the changed parameter so we know which linked params to preserve vs cascade
    // Pass the API params directly (snake_case) and original params (camelCase)
    const finalParams = preserveLinkedParameters(validParams, params, appState, paramType);
    
    // Store corrected parameters
    columnParameters.set(runId, createParameterStructure(finalParams));
    
    // Update the actual run state
    run.scenario = finalParams.scenario;
    run.scene = finalParams.scene;
    run.admType = finalParams.admType;
    run.llmBackbone = finalParams.llmBackbone;
    run.runVariant = finalParams.runVariant;
    run.kdmaValues = finalParams.kdmaValues;
    
    // Store the available options for UI dropdowns
    run.availableOptions = {
      scenarios: validOptions.scenario || [],
      scenes: validOptions.scene || [],
      admTypes: validOptions.adm || [],
      llms: validOptions.llm || [],
      runVariants: validOptions.run_variant || [],
      kdmaValues: {
        validCombinations: validOptions.kdma_values || []
      }
    };
    
    // If this is a linked parameter and this is a direct user update, propagate to other runs
    if (!isPropagatedUpdate && isParameterLinked(paramType, appState)) {
      const propagationResult = propagateParameterToAllRuns(paramType, newValue, runId, appState, syncCallbacks);
      
      // Trigger async reloads if needed (fire-and-forget)
      if (propagationResult.needsReload && propagationResult.runIdsToReload.length > 0) {
        propagationResult.runIdsToReload.forEach(runIdToReload => {
          reloadPinnedRun(runIdToReload).catch(error => {
            console.error(`Error reloading run ${runIdToReload}:`, error);
          });
        });
      }
    }
    
    return finalParams;
  }

  // URL State Management System
  const urlState = {
    // Encode current state to URL
    updateURL() {
      const newURL = encodeStateToURL(appState);
      window.history.replaceState(null, '', newURL);
    },

    // Restore state from URL on page load
    async restoreFromURL() {
      const state = decodeStateFromURL();
      
      if (state) {
        // Restore link state
        if (state.linkedParameters && Array.isArray(state.linkedParameters)) {
          appState.linkedParameters = new Set(state.linkedParameters);
        }
        
        // Restore pinned runs
        if (state.pinnedRuns && state.pinnedRuns.length > 0) {
          for (const runConfig of state.pinnedRuns) {
            // Convert runConfig to params format expected by addColumn
            // Don't pass availableOptions - let addColumn calculate them fresh
            const params = {
              scenario: runConfig.scenario,
              scene: runConfig.scene,
              admType: runConfig.admType,
              llmBackbone: runConfig.llmBackbone,
              runVariant: runConfig.runVariant,
              kdmaValues: runConfig.kdmaValues
            };
            // Skip URL updates during batch restoration
            await addColumn(params, { updateURL: false });
          }
          // Update URL once after all runs are restored
          urlState.updateURL();
        }
        
        return true; // Successfully restored
      }
      return false; // No state to restore
    }
  };

  // Function to fetch and parse manifest.json
  async function fetchManifest() {
      const result = await loadManifest();
      window.updateAppParameters = result.updateAppParameters;
      
      const initialResult = window.updateAppParameters({
        scenario: null,
        scene: null,
        kdma_values: [],
        adm: null,
        llm: null,
        run_variant: null
      }, {});
      
      // Store first valid parameters for auto-pinning but don't populate appState selections
      const firstValidParams = {
        scenario: initialResult.params.scenario,
        scene: initialResult.params.scene,
        admType: initialResult.params.adm,
        llmBackbone: initialResult.params.llm,
        runVariant: initialResult.params.run_variant,
        kdmaValues: initialResult.params.kdma_values || {},
        availableScenarios: initialResult.options.scenario || [],
        availableScenes: initialResult.options.scene || [], 
        availableAdmTypes: initialResult.options.adm || [],
        availableLLMs: initialResult.options.llm || []
      };
      
      // Try to restore state from URL, otherwise auto-pin first valid configuration
      const restoredFromURL = await urlState.restoreFromURL();
      if (!restoredFromURL) {
        // Auto-pin the first valid configuration if no pinned runs exist
        if (appState.pinnedRuns.size === 0 && firstValidParams.scenario) {
          await addColumn(firstValidParams);
        }
      }
  }

  
  // Generic parameter change handler for simple cases
  async function handleSimpleParameterChange(runId, parameter, value, options = {}) {
    await window.updatePinnedRunState({
      runId,
      parameter,
      value,
      needsReload: true,
      updateUI: true,
      ...options
    });
  }

  // Generic parameter change handler factory
  const createParameterChangeHandler = (parameterName, options = {}) => {
    return async function(runId, newValue) {
      await handleSimpleParameterChange(runId, parameterName, newValue, options);
    };
  };

  window.handleRunLLMChange = createParameterChangeHandler('llmBackbone', { updateUI: false });
  window.handleRunVariantChange = createParameterChangeHandler('runVariant');
  window.handleRunSceneChange = createParameterChangeHandler('scene');
  window.handleRunScenarioChange = createParameterChangeHandler('scenario');

  window.handleRunADMChange = createParameterChangeHandler('admType');


  window.addKDMAToRun = async function(runId) {
    const run = appState.pinnedRuns.get(runId);
    
    const availableKDMAs = getValidKDMAsForRun(runId, appState.pinnedRuns);
    const currentKDMAs = run.kdmaValues || {};
    const maxKDMAs = getMaxKDMAsForRun(runId, appState.pinnedRuns);
    const minimumRequired = getMinimumRequiredKDMAs(runId, appState.pinnedRuns);
    
    if (Object.keys(currentKDMAs).length >= maxKDMAs) {
      console.warn(`Cannot add KDMA: max limit (${maxKDMAs}) reached for run ${runId}`);
      return;
    }
    
    // If we have no KDMAs and need to add multiple at once for a valid combination
    if (Object.keys(currentKDMAs).length === 0 && minimumRequired > 1) {
      // Add a complete valid combination
      const validCombinations = run.availableOptions?.kdmaValues?.validCombinations || [];
      if (validCombinations.length > 0) {
        // Find the first non-empty combination (skip unaligned empty combinations)
        const firstNonEmptyCombination = validCombinations.find(combination => Object.keys(combination).length > 0);
        
        if (firstNonEmptyCombination) {
          await updatePinnedRunState({
            runId,
            parameter: 'kdmaValues',
            value: { ...firstNonEmptyCombination },
            needsReload: true,
            updateUI: true
          });
          return;
        }
      }
    }
    
    // Standard single-KDMA addition logic
    const availableTypes = Object.keys(availableKDMAs).filter(type => 
      currentKDMAs[type] === undefined
    );
    
    if (availableTypes.length === 0) {
      console.warn(`No available KDMA types for run ${runId}`);
      return;
    }
    
    const kdmaType = availableTypes[0];
    const validValues = Array.from(availableKDMAs[kdmaType] || []);
    const initialValue = validValues.length > 0 ? validValues[0] : 0.0;
    
    // Update KDMAs through the parameter validation system
    const newKDMAs = { ...currentKDMAs, [kdmaType]: initialValue };
    
    await updatePinnedRunState({
      runId,
      parameter: 'kdmaValues',
      value: newKDMAs,
      needsReload: true,
      updateUI: true
    });
  };

  // Helper function for KDMA updates
  async function updateKDMAsForRun(runId, modifier, options = {}) {
    const run = appState.pinnedRuns.get(runId);
    if (!run) return;
    
    const currentKDMAs = { ...(run.kdmaValues || {}) };
    const updatedKDMAs = modifier(currentKDMAs);
    
    await updatePinnedRunState({
      runId,
      parameter: 'kdmaValues',
      value: updatedKDMAs,
      needsReload: true,
      updateUI: true,
      ...options
    });
  }

  window.removeKDMAFromRun = async function(runId, kdmaType) {
    const run = appState.pinnedRuns.get(runId);
    const kdmaOptions = run?.availableOptions?.kdmaValues;
    
    await updateKDMAsForRun(runId, (kdmas) => {
      const updated = { ...kdmas };
      delete updated[kdmaType];
      
      // Check if the remaining combination is valid
      const hasValidRemaining = kdmaOptions?.validCombinations?.some(combination => {
        return KDMAUtils.deepEqual(updated, combination);
      });
      
      // If remaining combination is not valid but empty combination is available,
      // clear all KDMAs to reach the unaligned state
      if (!hasValidRemaining) {
        const hasEmptyOption = kdmaOptions?.validCombinations?.some(combination => {
          return Object.keys(combination).length === 0;
        });
        
        if (hasEmptyOption) {
          return {}; // Clear all KDMAs to reach unaligned state
        }
      }
      
      return updated; // Normal removal
    });
  };

  window.handleRunKDMATypeChange = async function(runId, oldKdmaType, newKdmaType) {
    const availableKDMAs = getValidKDMAsForRun(runId, appState.pinnedRuns);
    
    await updateKDMAsForRun(runId, (kdmas) => {
      const updated = { ...kdmas };
      const currentValue = updated[oldKdmaType];
      
      // Remove old type
      delete updated[oldKdmaType];
      
      // Get valid values for new type and adjust value if needed
      const validValues = availableKDMAs[newKdmaType] || [];
      let newValue = currentValue;
      
      if (validValues.length > 0 && !validValues.some(v => Math.abs(v - newValue) < FLOATING_POINT_TOLERANCE)) {
        newValue = validValues[0]; // Use first valid value
      }
      
      updated[newKdmaType] = newValue;
      return updated;
    });
  };

  window.handleRunKDMAValueChange = async function(runId, kdmaType, value) {
    const run = appState.pinnedRuns.get(runId);
    if (!run) return;
    
    const normalizedValue = KDMAUtils.normalizeValue(value);
    
    // Update the KDMA values
    await updateKDMAsForRun(runId, (kdmas) => ({
      ...kdmas,
      [kdmaType]: normalizedValue
    }), {
      updateURL: true
    });
  };



  // Show/hide loading spinner
  function showLoadingSpinner() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
      spinner.style.visibility = 'visible';
    }
  }
  
  function hideLoadingSpinner() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
      spinner.style.visibility = 'hidden';
    }
  }

  // Reload data for a specific pinned run after parameter changes (pure approach)
  async function reloadPinnedRun(runId) {
    const run = appState.pinnedRuns.get(runId);
    if (!run) {
      console.warn(`Run ${runId} not found in pinned runs`);
      return;
    }
    
    // Prevent concurrent reloads for the same run
    if (run.isReloading) {
      return;
    }
    
    // Mark as reloading to prevent concurrent requests
    run.isReloading = true;
    
    // Show loading spinner instead of rendering the whole table
    run.loadStatus = 'loading';
    showLoadingSpinner();

    // Get updated parameters from columnParameters
    const params = getParametersForRun(runId);
    
    // Always update run parameters to reflect the intended state first
    run.scenario = params.scenario;
    run.scene = params.scene;
    run.admType = params.admType;
    run.llmBackbone = params.llmBackbone;
    run.runVariant = params.runVariant;
    run.kdmaValues = { ...params.kdmaValues };
    
    try {
      // Check if parameters resolve to a valid run before attempting fetch
      const runInfo = resolveParametersToRun({
        scenario: params.scenario,
        scene: params.scene,
        admType: params.admType,
        llmBackbone: params.llmBackbone,
        kdmaValues: params.kdmaValues,
        runVariant: params.runVariant
      });
      
      if (!runInfo) {
        // No matching experiment exists for this parameter combination
        console.warn(`No experiment found for run ${runId} with current parameter combination`);
        run.loadStatus = 'no-match';
        run.noDataReason = 'No experiment exists for this parameter combination';
        run.isReloading = false;
        renderComparisonTable();
        return;
      }
      
      // Load new data using fetchRunData (we know it should work now)
      const experimentData = await fetchRunData({
        scenario: params.scenario,
        scene: params.scene,
        admType: params.admType,
        llmBackbone: params.llmBackbone,
        kdmaValues: params.kdmaValues,
        runVariant: params.runVariant
      });
      
      if (!experimentData || !experimentData.inputOutput) {
        console.warn(`Failed to fetch data for run ${runId} despite valid runInfo`);
        run.loadStatus = 'no-data';
        run.noDataReason = 'Failed to load experiment data';
      } else {
        // Update with new results
        run.experimentKey = experimentData.experimentKey;
        run.inputOutput = experimentData.inputOutput;
        run.inputOutputArray = experimentData.inputOutputArray;
        run.timing = experimentData.timing;
        run.timing_s = experimentData.timing_s;
        run.loadStatus = 'loaded';
      }
      
    } catch (error) {
      console.error(`Failed to reload data for run ${runId}:`, error);
      run.loadStatus = 'error';
      run.noDataReason = 'Error loading experiment data';
    } finally {
      // Clear the reloading flag
      run.isReloading = false;
    }
    
    renderComparisonTable();
  }


  // Render the comparison table with pinned runs only
  function renderComparisonTable() {
    // Hide loading spinner when rendering is complete
    hideLoadingSpinner();
    
    const container = document.getElementById('runs-container');
    if (!container) return;
    
    // Save current Choice Info expansion states before re-rendering
    const savedChoiceInfoStates = new Map();
    for (const [key, value] of expandableStates.objects.entries()) {
      if (key.startsWith('choice_info_section_')) {
        savedChoiceInfoStates.set(key, value);
      }
    }

    // Get all pinned runs for comparison
    const allRuns = Array.from(appState.pinnedRuns.values());
    
    // Extract all parameters from runs
    const parameters = extractParametersFromRuns(allRuns);
    
    // Show/hide the Add Column button based on pinned runs
    const addColumnBtn = document.getElementById('add-column-btn');
    if (addColumnBtn) {
      addColumnBtn.style.display = appState.pinnedRuns.size > 0 ? 'inline-block' : 'none';
    }
    
    // Find the existing table elements
    const table = container.querySelector('.comparison-table');
    if (!table) return;
    
    const thead = table.querySelector('thead tr');
    const tbody = table.querySelector('tbody');
    if (!thead || !tbody) return;
    
    // Clear existing run columns from header (keep first column)
    const headerCells = thead.querySelectorAll('th:not(.parameter-header)');
    headerCells.forEach(cell => cell.remove());
    
    // Add pinned run headers
    Array.from(appState.pinnedRuns.entries()).forEach(([runId, runData], index) => {
      const th = document.createElement('th');
      th.className = 'pinned-run-header';
      th.setAttribute('data-run-id', runId);
      th.setAttribute('data-experiment-key', runData.experimentKey || 'none');
      
      // Add tooltip for no-match state
      if (runData.loadStatus === 'no-match') {
        th.title = runData.noDataReason || 'No matching experiment found';
      }
      
      // Always render button but control visibility to prevent layout shifts
      const shouldShowButton = index > 0 || appState.pinnedRuns.size > 1;
      const visibility = shouldShowButton ? 'visible' : 'hidden';
      let headerContent = `<button class="remove-run-btn" onclick="removeRun('${runId}')" style="visibility: ${visibility};">×</button>`;
      
      
      th.innerHTML = headerContent;
      
      thead.appendChild(th);
    });
    
    // Clear existing run value columns from all parameter rows (keep first column)
    const parameterRows = tbody.querySelectorAll('.parameter-row');
    parameterRows.forEach(row => {
      const valueCells = row.querySelectorAll('td:not(.parameter-name)');
      valueCells.forEach(cell => cell.remove());
    });
    
    // Update sync checkbox states and row visual indicators
    parameters.forEach((paramInfo, paramName) => {
      const row = tbody.querySelector(`tr[data-parameter="${paramName}"]`);
      if (!row) return;
      
      // Update link state visual indicators
      const linkIcon = row.querySelector('.link-icon');
      // Map snake_case parameter names to camelCase for link checking
      const linkParamName = API_TO_APP[paramName] || paramName;
      
      if (isParameterLinked(linkParamName, appState)) {
        row.classList.add('linked');
        if (linkIcon) {
          linkIcon.textContent = '🔗';
        }
      } else {
        row.classList.remove('linked');
        if (linkIcon) {
          linkIcon.textContent = '⛓️‍💥';
        }
      }
      
      // Pinned run values with border if different from previous column
      let previousValue = null;
      let isFirstColumn = true;
      appState.pinnedRuns.forEach((runData) => {
        const pinnedValue = getParameterValue(runData, paramName);
        const isDifferent = !isFirstColumn && !compareValues(previousValue, pinnedValue);
        
        const td = document.createElement('td');
        td.className = 'pinned-run-value';
        if (isDifferent) {
          td.style.borderLeft = '3px solid #007bff';
        }
        
        // Handle no-data and no-match states for result parameters
        if ((runData.loadStatus === 'no-data' || runData.loadStatus === 'no-match') && isResultParameter(paramName)) {
          td.innerHTML = `<div class="no-data-message">No data available<div class="no-data-reason">${runData.noDataReason || 'No matching experiment found'}</div></div>`;
        } else {
          td.innerHTML = formatValue(pinnedValue, paramInfo.type, paramName, runData.id, appState.pinnedRuns);
        }
        
        row.appendChild(td);
        
        previousValue = pinnedValue;
        isFirstColumn = false;
      });
    });
    
    // Restore saved Choice Info expansion states after re-rendering
    setTimeout(() => {
      for (const [sectionId, wasExpanded] of savedChoiceInfoStates.entries()) {
        if (wasExpanded) {
          const button = document.getElementById(`${sectionId}_button`);
          const detailsDiv = document.getElementById(`${sectionId}_details`);
          const summarySpan = document.getElementById(`${sectionId}_summary`);
          
          if (button && detailsDiv && summarySpan) {
            // Restore the expanded state
            detailsDiv.style.display = 'block';
            summarySpan.style.display = 'none';
            button.textContent = 'Hide Details';
            
            // Also update the global state
            expandableStates.objects.set(sectionId, true);
          }
        }
      }
    }, 0);
  }

  // Extract parameters from all runs to determine table structure
  function extractParametersFromRuns() {
    const parameters = new Map();
    
    // Configuration parameters
    parameters.set("scene", { type: "string", required: true });
    parameters.set("scenario", { type: "string", required: true });
    parameters.set("scenario_state", { type: "longtext", required: false });
    parameters.set("available_choices", { type: "choices", required: false });
    parameters.set("choice_info", { type: "choice_info", required: false });
    parameters.set("kdma_values", { type: "kdma_values", required: false });
    parameters.set("adm_type", { type: "string", required: true });
    parameters.set("llm_backbone", { type: "string", required: true });
    parameters.set("run_variant", { type: "string", required: false });
    
    // ADM Decision (using Pydantic model structure)
    parameters.set("adm_decision", { type: "text", required: false });
    parameters.set("justification", { type: "longtext", required: false });
    
    // Timing data
    parameters.set("probe_time", { type: "number", required: false });
    
    // Raw Data
    parameters.set("input_output_json", { type: "object", required: false });
    
    return parameters;
  }

  // Extract parameter value from run data using Pydantic model structure
  function getParameterValue(run, paramName) {
    if (!run) return 'N/A';
    
    // Configuration parameters
    if (paramName === 'scene') return run.scene || 'N/A';
    if (paramName === 'scenario') return run.scenario || 'N/A';
    if (paramName === 'adm_type') return run.admType || 'N/A';
    if (paramName === 'llm_backbone') return run.llmBackbone || 'N/A';
    if (paramName === 'run_variant') return run.runVariant || 'N/A';
    
    // KDMA Values - single row showing all KDMA values
    if (paramName === 'kdma_values') {
      return run.kdmaValues || {};
    }
    
    // Scenario details
    if (paramName === 'scenario_state' && run.inputOutput?.input) {
      return run.inputOutput.input.state || 'N/A';
    }
    
    // Available choices
    if (paramName === 'available_choices' && run.inputOutput?.input?.choices) {
      return run.inputOutput.input.choices;
    }
    
    // Choice info
    if (paramName === 'choice_info' && run.inputOutput?.choice_info) {
      return run.inputOutput.choice_info;
    }
    
    // ADM Decision - proper extraction using Pydantic model structure
    if (paramName === 'adm_decision' && run.inputOutput?.output && run.inputOutput?.input?.choices) {
      const choiceIndex = run.inputOutput.output.choice;
      const choices = run.inputOutput.input.choices;
      if (typeof choiceIndex === 'number' && choices[choiceIndex]) {
        return choices[choiceIndex].unstructured || choices[choiceIndex].action_id || 'N/A';
      }
      return 'N/A';
    }
    
    // Justification - proper path using Pydantic model structure
    if (paramName === 'justification' && run.inputOutput?.output?.action) {
      return run.inputOutput.output.action.justification || 'N/A';
    }
    
    // Timing data - comes from scene timing_s in manifest
    if (paramName === 'probe_time' && run.timing_s !== undefined && run.timing_s !== null) {
      return run.timing_s.toFixed(2);
    }
    
    // Raw Data - inputOutput is already the correct object for this scene
    if (paramName === 'input_output_json' && run.inputOutput) {
      return run.inputOutput;
    }
    
    return 'N/A';
  }





  // Add a column with specific parameters (no appState manipulation)
  async function addColumn(params, options = {}) {
    if (!params.scenario) {
      console.warn('No scenario provided for addColumn');
      return;
    }

    // Create run config from parameters
    const runConfig = createRunConfigFromParams(params);
    
    // Fetch data for these parameters
    const runData = await fetchRunData({
      scenario: params.scenario,
      scene: params.scene,
      admType: params.admType,
      llmBackbone: params.llmBackbone,
      runVariant: params.runVariant,
      kdmaValues: params.kdmaValues
    });
    
    if (!runData || !runData.inputOutput) {
      throw new Error('No data found for parameters');
    }
    
    // Store complete run data
    const pinnedData = {
      ...runConfig,
      inputOutput: runData.inputOutput,
      inputOutputArray: runData.inputOutputArray,
      timing: runData.timing,
      timing_s: runData.timing_s,
      loadStatus: 'loaded'
    };
    
    appState.pinnedRuns.set(runConfig.id, pinnedData);
    renderComparisonTable();
    
    // Only update URL if not explicitly disabled (e.g., during batch restoration)
    if (options.updateURL !== false) {
      urlState.updateURL();
    }
    
    return runConfig.id; // Return the ID for reference
  }


  // Copy the rightmost column's parameters to create a new column
  async function copyColumn() {
    if (appState.pinnedRuns.size === 0) {
      console.warn('No columns to copy from');
      return;
    }
    
    // Get parameters from the rightmost (last) pinned run
    const pinnedRunsArray = Array.from(appState.pinnedRuns.values());
    const lastRun = pinnedRunsArray[pinnedRunsArray.length - 1];
    
    const params = {
      scene: lastRun.scene,
      scenario: lastRun.scenario,
      admType: lastRun.admType,
      llmBackbone: lastRun.llmBackbone,
      runVariant: lastRun.runVariant,
      kdmaValues: lastRun.kdmaValues,
      availableScenarios: lastRun.availableOptions?.scenarios || [],
      availableScenes: lastRun.availableOptions?.scenes || [],
      availableAdmTypes: lastRun.availableOptions?.admTypes || [],
      availableLLMs: lastRun.availableOptions?.llms || []
    };
    
    // Use the new addColumn function
    return await addColumn(params);
  }

  // Toggle functions for expandable content
  window.toggleText = function(id) {
    const shortSpan = document.getElementById(`${id}_short`);
    const fullSpan = document.getElementById(`${id}_full`);
    const button = document.querySelector(`[onclick="toggleText('${id}')"]`);
    
    const isCurrentlyExpanded = fullSpan.style.display !== 'none';
    const newExpanded = !isCurrentlyExpanded;
    
    if (newExpanded) {
      shortSpan.style.display = 'none';
      fullSpan.style.display = 'inline';
      button.textContent = 'Show Less';
    } else {
      shortSpan.style.display = 'inline';
      fullSpan.style.display = 'none';
      button.textContent = 'Show More';
    }
    
    // Save state for persistence
    expandableStates.text.set(id, newExpanded);
  };


  window.toggleObject = function(id) {
    const preview = document.getElementById(`${id}_preview`);
    const full = document.getElementById(`${id}_full`);
    const button = document.querySelector(`[onclick="toggleObject('${id}')"]`);
    
    const isCurrentlyExpanded = full.style.display !== 'none';
    const newExpanded = !isCurrentlyExpanded;
    
    if (newExpanded) {
      preview.style.display = 'none';
      full.style.display = 'block';
      button.textContent = 'Show Preview';
    } else {
      preview.style.display = 'inline';
      full.style.display = 'none';
      button.textContent = 'Show Details';
    }
    
    // Save state for persistence
    expandableStates.objects.set(id, newExpanded);
  };

  // Remove a pinned run
  function removeRun(runId) {
    window.updatePinnedRunState({
      runId,
      action: 'remove',
      needsCleanup: true
    });
  }
  
  // Generalized function for handling pinned run state updates
  window.updatePinnedRunState = async function(options = {}) {
    const {
      runId,
      action = 'update', // 'update', 'add', 'remove', 'clear'
      parameter,
      value,
      needsReload = false,
      needsCleanup = false,
      updateUI = true,
      updateURL = true,
      debounceMs = 0
    } = options;

    const executeUpdate = async () => {
      try {
        // Handle different types of actions
        switch (action) {
          case 'remove':
            if (runId) {
              appState.pinnedRuns.delete(runId);
              if (needsCleanup) {
                cleanupRunStates(runId);
              }
            }
            break;
            
          case 'clear':
            // Clean up all runs before clearing
            appState.pinnedRuns.forEach((_, id) => cleanupRunStates(id));
            appState.pinnedRuns.clear();
            break;
            
          case 'add':
            if (runId && value) {
              appState.pinnedRuns.set(runId, value);
            }
            break;
            
          case 'update':
          default:
            if (runId && parameter !== undefined) {
              updateParameterForRun(runId, parameter, value);
            }
            break;
        }

        // Reload data if needed
        if (needsReload && runId) {
          await reloadPinnedRun(runId);
          // reloadPinnedRun already calls renderComparisonTable, so skip the updateUI render
        } else {
          // Update UI if requested (only if we didn't reload, which already renders)
          if (updateUI) {
            renderComparisonTable();
          }
        }

        // Update URL state if requested
        if (updateURL) {
          urlState.updateURL();
        }

      } catch (error) {
        console.error('Error updating pinned run state:', error);
        throw error;
      }
    };

    // Execute immediately or with debounce
    if (debounceMs > 0) {
      // Clear any existing timeout for this operation
      if (window.updatePinnedRunState._debounceTimeout) {
        clearTimeout(window.updatePinnedRunState._debounceTimeout);
      }
      
      window.updatePinnedRunState._debounceTimeout = setTimeout(executeUpdate, debounceMs);
    } else {
      await executeUpdate();
    }
  }
  
  // Clean up expansion states when a run is removed
  function cleanupRunStates(runId) {
    // Remove text expansion states for this run
    for (const [key] of expandableStates.text.entries()) {
      if (key.includes(`_${runId}_`)) {
        expandableStates.text.delete(key);
      }
    }
    
    // Remove object expansion states for this run
    for (const [key] of expandableStates.objects.entries()) {
      if (key.includes(`_${runId}_`)) {
        expandableStates.objects.delete(key);
      }
    }
  }

  window.removeRun = removeRun;

  // Initialize static button event listeners
  const addColumnBtn = document.getElementById('add-column-btn');
  if (addColumnBtn) {
    addColumnBtn.addEventListener('click', copyColumn);
  }

  // Add CSV download button event listener
  const downloadCsvBtn = document.getElementById('download-csv-btn');
  if (downloadCsvBtn) {
    downloadCsvBtn.addEventListener('click', downloadCSV);
  }

  // Initial manifest fetch on page load
  fetchManifest();
});
