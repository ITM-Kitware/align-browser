// Functional State Management Module
// Pure functions for managing application state without mutations

import { showWarning } from './notifications.js';

// Centralized parameter mappings
export const PARAMETER_MAPPINGS = {
  // Maps validation API names back to internal names
  API_TO_INTERNAL: {
    'scenario': 'scenario',
    'scene': 'scene',
    'adm': 'admType',
    'llm': 'llmBackbone',
    'kdma_values': 'kdmaValues',
    'run_variant': 'runVariant'
  }
};

// Constants for KDMA processing
const KDMA_CONSTANTS = {
  DECIMAL_PRECISION: 10, // For 1 decimal place normalization
  DISPLAY_PRECISION: 1   // For display formatting
};

// KDMA Utility Functions
export const KDMAUtils = {
  // Normalize KDMA value to 1 decimal place
  normalizeValue: (value) => Math.round(parseFloat(value) * KDMA_CONSTANTS.DECIMAL_PRECISION) / KDMA_CONSTANTS.DECIMAL_PRECISION,
  
  // Format KDMA value for display (1 decimal place)
  formatValue: (value) => typeof value === 'number' ? value.toFixed(KDMA_CONSTANTS.DISPLAY_PRECISION) : value,
  
  // Convert KDMA object to sorted array for serialization
  toSortedArray: (kdmaObject) => {
    return Object.entries(kdmaObject)
      .map(([kdma, value]) => ({ kdma, value: KDMAUtils.normalizeValue(value) }))
      .sort((a, b) => a.kdma.localeCompare(b.kdma));
  },
  
  // Convert KDMA object to sorted array and serialize for keys
  serializeToKey: (kdmaObject) => {
    return JSON.stringify(KDMAUtils.toSortedArray(kdmaObject));
  },
  
  // Convert KDMA object to key parts for experiment keys
  toKeyParts: (kdmaObject) => {
    return Object.entries(kdmaObject)
      .map(([kdma, value]) => `${kdma}-${KDMAUtils.formatValue(value)}`)
      .sort();
  },
  
  // Deep equality comparison for objects
  deepEqual: (obj1, obj2) => {
    if (obj1 === obj2) return true;
    if (!obj1 || !obj2) return obj1 === obj2;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    return keys1.every(key => {
      if (!keys2.includes(key)) return false;
      const val1 = obj1[key];
      const val2 = obj2[key];
      
      // Handle nested objects recursively
      if (typeof val1 === 'object' && typeof val2 === 'object') {
        return KDMAUtils.deepEqual(val1, val2);
      }
      
      // Handle numeric comparison with normalization
      if (typeof val1 === 'number' && typeof val2 === 'number') {
        return KDMAUtils.normalizeValue(val1) === KDMAUtils.normalizeValue(val2);
      }
      
      return val1 === val2;
    });
  },
  
  // Backwards compatibility alias
  objectsEqual: function(obj1, obj2) {
    return this.deepEqual(obj1, obj2);
  }
};

// Create initial empty state
export function createInitialState() {
  return {
    // Data from manifest
    availableScenarios: [],
    availableScenes: [],
    availableAdmTypes: [],
    availableKDMAs: [],
    availableLLMs: [],
    
    // Comparison state
    pinnedRuns: new Map(),
    linkedParameters: new Set()
  };
}





// Generate a unique run ID
export function generateRunId() {
  const timestamp = new Date().getTime();
  const random = Math.random().toString(36).substring(2, 11);
  return `run_${timestamp}_${random}`;
}


// Create a run configuration factory function
export function createRunConfig(params, availableKDMAs) {
  // Create sophisticated KDMA structure that preserves permutation constraints
  const kdmaStructure = {
    validCombinations: [], // Array of valid KDMA combinations
    availableTypes: new Set(), // All KDMA types that appear in any combination
    typeValueMap: {} // kdmaType -> Set of all possible values for that type
  };
  
  if (availableKDMAs && Array.isArray(availableKDMAs)) {
    // Store all valid combinations and build type/value maps
    availableKDMAs.forEach(kdmaCombination => {
      // Store the valid combination as object for unified usage
      kdmaStructure.validCombinations.push({ ...kdmaCombination });
      
      // Extract types and values for the maps
      Object.entries(kdmaCombination).forEach(([kdma, value]) => {
        if (kdma && value !== undefined) {
          kdmaStructure.availableTypes.add(kdma);
          if (!kdmaStructure.typeValueMap[kdma]) {
            kdmaStructure.typeValueMap[kdma] = new Set();
          }
          kdmaStructure.typeValueMap[kdma].add(value);
        }
      });
    });
  }
  
  // Generate experiment key directly
  const kdmaParts = KDMAUtils.toKeyParts(params.kdmaValues || {});
  const kdmaString = kdmaParts.join("_");
  const experimentKey = `${params.admType}:${params.llmBackbone}:${kdmaString}:${params.runVariant}`;
  
  return {
    id: generateRunId(),
    timestamp: new Date().toISOString(),
    scenario: params.scenario,
    scene: params.scene,
    admType: params.admType,
    llmBackbone: params.llmBackbone,
    runVariant: params.runVariant,
    kdmaValues: { ...params.kdmaValues },
    experimentKey,
    loadStatus: 'pending',
    // Store available options at time of creation for dropdown population
    availableOptions: {
      scenarios: params.availableScenarios || [],
      scenes: params.availableScenes || [],
      admTypes: params.availableAdmTypes || [],
      llms: params.availableLLMs || [],
      kdmaValues: kdmaStructure  // Sophisticated structure with constraint information
    }
  };
}

// Parameter structure factory for run management
export function createParameterStructure(params = {}) {
  return {
    scenario: params.scenario || null,
    scene: params.scene || null,
    admType: params.admType || null,
    llmBackbone: params.llmBackbone || null,
    runVariant: params.runVariant || 'default',
    kdmaValues: params.kdmaValues || {}
  };
}

// URL State Management Functions
export function encodeStateToURL(state) {
  const manifest = GlobalState.getManifest();
  const urlState = {
    manifestCreatedAt: manifest?.generated_at,
    linkedParameters: Array.from(state.linkedParameters || []),
    pinnedRuns: Array.from(state.pinnedRuns.values()).map(run => ({
      scenario: run.scenario,
      scene: run.scene,
      admType: run.admType,
      llmBackbone: run.llmBackbone,
      runVariant: run.runVariant,
      kdmaValues: run.kdmaValues,
      id: run.id
    }))
  };
  
  try {
    const encodedState = btoa(JSON.stringify(urlState));
    return `${window.location.pathname}?state=${encodedState}`;
  } catch (e) {
    console.warn('Failed to encode URL state:', e);
    return window.location.pathname;
  }
}

export function decodeStateFromURL() {
  const params = new URLSearchParams(window.location.search);
  const stateParam = params.get('state');
  
  if (stateParam) {
    try {
      const decodedState = JSON.parse(atob(stateParam));
      
      // Validate manifest creation date if present
      const currentManifest = GlobalState.getManifest();
      if (currentManifest && decodedState.manifestCreatedAt && 
          decodedState.manifestCreatedAt !== currentManifest.generated_at) {
        showWarning('URL parameters are from an older version and have been reset');
        return null;
      }
      
      return decodedState;
    } catch (e) {
      console.warn('Invalid URL state, using defaults:', e);
      return null;
    }
  }
  return null;
}

// Configuration for parameter validation system
export const PARAMETER_CONFIG = {
  // Priority order for parameter cascading
  PRIORITY_ORDER: ['scenario', 'scene', 'kdma_values', 'adm', 'llm', 'run_variant'],
  
  // Parameters that require special handling
  SPECIAL_COMPARISON_PARAMS: new Set(['kdma_values'])
};

// Parameter update system with priority-based cascading
const updateParametersBase = (priorityOrder) => (manifest) => (currentParams, changes) => {
  const newParams = { ...currentParams, ...changes };
  
  // Helper to check if manifest entry matches current selection
  const matchesCurrentSelection = (manifestEntry, excludeParam, currentSelection) => {
    const excludeParamIndex = priorityOrder.indexOf(excludeParam);
    
    for (const param of priorityOrder) {
      if (param === excludeParam) continue;
      
      const paramIndex = priorityOrder.indexOf(param);
      
      // Only apply constraints from higher priority parameters (already set)
      // Lower priority parameters shouldn't constrain higher priority ones
      if (paramIndex >= excludeParamIndex) {
        continue; // Skip constraints from same or lower priority parameters
      }
      
      // Only check constraint if the current selection has a non-null value for this parameter
      if (currentSelection[param] !== null && currentSelection[param] !== undefined) {
        // Special handling for parameters that need custom comparison
        if (PARAMETER_CONFIG.SPECIAL_COMPARISON_PARAMS.has(param)) {
          if (param === 'kdma_values') {
            const manifestKdmas = manifestEntry[param];
            const selectionKdmas = currentSelection[param];
            
            if (!KDMAUtils.deepEqual(manifestKdmas, selectionKdmas)) {
              return false;
            }
          }
        } else if (manifestEntry[param] !== currentSelection[param]) {
          return false;
        }
      }
    }
    return true;
  };
  
  // Helper to get valid options for a parameter
  const getValidOptionsFor = (parameterName, currentSelection) => {
    const validEntries = manifest.filter(entry => 
      matchesCurrentSelection(entry, parameterName, currentSelection)
    );
    const options = [...new Set(validEntries.map(entry => entry[parameterName]))];
    
    return options;
  };
  
  // Find the highest priority parameter that changed
  const changedParams = Object.keys(changes);
  let highestChangedIndex;
  
  if (changedParams.length === 0) {
    // No changes provided - validate/correct all parameters from the beginning
    highestChangedIndex = -1;
  } else {
    highestChangedIndex = Math.min(
      ...changedParams.map(param => priorityOrder.indexOf(param))
    );
  }
  
  // Check and potentially update parameters starting from the highest changed index
  for (let i = highestChangedIndex + 1; i < priorityOrder.length; i++) {
    const param = priorityOrder[i];
    const currentValue = newParams[param];
    const validOptions = getValidOptionsFor(param, newParams);
    
    // Only change if current value is invalid
    let isValid = validOptions.includes(currentValue);
    
    // For special parameters, use custom comparison logic
    if (PARAMETER_CONFIG.SPECIAL_COMPARISON_PARAMS.has(param) && !isValid) {
      if (param === 'kdma_values') {
        isValid = validOptions.some(option => {
          return KDMAUtils.deepEqual(option, currentValue);
        });
      }
    }
    
    if (!isValid) {
      const newValue = validOptions.length > 0 ? validOptions[0] : null;
      newParams[param] = newValue;
    }
  }
  
  // Calculate available options for all parameters
  const availableOptions = {};
  for (const param of priorityOrder) {
    availableOptions[param] = getValidOptionsFor(param, newParams);
  }
  
  return {
    params: newParams,
    options: availableOptions
  };
};

// Export updateParameters with priority order already curried
export const updateParameters = updateParametersBase(PARAMETER_CONFIG.PRIORITY_ORDER);

export function toggleParameterLink(paramName, appState, callbacks) {
  if (appState.linkedParameters.has(paramName)) {
    appState.linkedParameters.delete(paramName);
    callbacks.renderTable();
    callbacks.updateURL();
    return null;
  } else {
    appState.linkedParameters.add(paramName);
    // When enabling link, propagate the leftmost column's value
    const firstRun = Array.from(appState.pinnedRuns.values())[0];
    const currentValue = getParameterValueFromRun(firstRun, paramName);
    const propagationResult = propagateParameterToAllRuns(paramName, currentValue, firstRun.id, appState, callbacks);
    callbacks.renderTable();
    callbacks.updateURL();
    return propagationResult;
  }
}

export function propagateParameterToAllRuns(paramName, value, sourceRunId, appState, callbacks) {
  // Temporarily disable link for this parameter to prevent infinite loops
  const wasLinked = appState.linkedParameters.has(paramName);
  appState.linkedParameters.delete(paramName);
  
  // Parameters that require data reload when changed
  const reloadRequiredParams = new Set([
    'scenario', 'scene', 'admType', 'llmBackbone', 'kdmaValues', 'runVariant'
  ]);
  
  const needsReload = reloadRequiredParams.has(paramName);
  
  // Collect run IDs that need reloading for the callback to handle
  const runIdsToReload = [];
  
  appState.pinnedRuns.forEach((_, runId) => {
    if (runId !== sourceRunId) {
      callbacks.updateParameterForRun(runId, paramName, value, true);
      
      // If this parameter change requires data reload, collect the runId
      if (needsReload) {
        runIdsToReload.push(runId);
      }
    }
  });
  
  // Re-enable link if it was previously enabled
  if (wasLinked) {
    appState.linkedParameters.add(paramName);
  }
  
  // Return information for the caller to handle async operations
  return {
    needsReload,
    runIdsToReload
  };
}

export function getParameterValueFromRun(run, paramName) {
  return run[paramName];
}

export function isParameterLinked(paramName, appState) {
  return appState.linkedParameters.has(paramName);
}

// Helper function to identify result parameters (those that depend on experiment data)
export function isResultParameter(paramName) {
  const resultParams = new Set([
    'scenario_state', 'available_choices', 'choice_info', 
    'adm_decision', 'justification', 'probe_time', 'input_output_json'
  ]);
  return resultParams.has(paramName);
}

// Global state encapsulation
const GlobalState = {
  manifest: null,
  parameterRunMap: new Map(),
  
  // Getters
  getManifest: () => GlobalState.manifest,
  getParameterRunMap: () => GlobalState.parameterRunMap,
  
  // Setters
  setManifest: (newManifest) => { GlobalState.manifest = newManifest; },
  clearParameterRunMap: () => { GlobalState.parameterRunMap.clear(); },
  setParameterRun: (key, value) => { GlobalState.parameterRunMap.set(key, value); },
  getParameterRun: (key) => GlobalState.parameterRunMap.get(key),
  
  // State queries
  hasManifest: () => GlobalState.manifest !== null,
  isParameterRunMapEmpty: () => GlobalState.parameterRunMap.size === 0
};

// Load and initialize manifest
export async function loadManifest() {
    const response = await fetch("./data/manifest.json");
    const manifest = await response.json();
    GlobalState.setManifest(manifest);
    
    // Initialize updateParameters with the transformed manifest
    const transformedManifest = transformManifestForUpdateParameters(manifest);
    const updateAppParameters = updateParameters(transformedManifest);
    
    return { manifest, updateAppParameters };
}


export function resolveParametersToRun(params) {
  if (GlobalState.isParameterRunMapEmpty()) {
    console.warn('parameterRunMap is empty or not initialized');
    return undefined;
  }
  
  const { scenario, scene, kdmaValues, admType, llmBackbone, runVariant } = params;
  
  const kdmaString = KDMAUtils.serializeToKey(kdmaValues || {});
  const mapKey = `${scenario}:${scene}:${kdmaString}:${admType}:${llmBackbone}:${runVariant}`;
  
  return GlobalState.getParameterRun(mapKey);
}

export async function fetchRunData(params) {
  const runInfo = resolveParametersToRun(params);
  if (!runInfo) {
    return undefined;
  }
  
  try {
    // Fetch both input/output and timing data
    const [inputOutputResponse, timingResponse] = await Promise.all([
      fetch(runInfo.inputOutputPath),
      fetch(runInfo.timingPath)
    ]);
    
    const inputOutputArray = await inputOutputResponse.json();
    const timingData = await timingResponse.json();
    
    
    // Return complete data structure
    return {
      inputOutput: inputOutputArray[runInfo.sourceIndex],
      inputOutputArray: inputOutputArray,
      timing: timingData,
      experimentKey: runInfo.experimentKey,
      timing_s: runInfo.timing_s
    };
  } catch (error) {
    console.error('Error fetching run data:', error);
    return undefined;
  }
}

// Transform hierarchical manifest to flat array for updateParameters
export function transformManifestForUpdateParameters(manifest) {
  const entries = [];
  
  if (!manifest.experiments) {
    console.warn('No experiments found in manifest');
    return entries;
  }
  
  GlobalState.clearParameterRunMap();
  
  for (const [experimentKey, experiment] of Object.entries(manifest.experiments)) {
    
    const { adm, llm, kdma_values, run_variant } = experiment.parameters;
    
    for (const [scenarioId, scenario] of Object.entries(experiment.scenarios)) {
      
      for (const [sceneId, sceneInfo] of Object.entries(scenario.scenes)) {
        // Convert KDMA array to object format for unified usage
        const kdmaObject = {};
        if (kdma_values && Array.isArray(kdma_values)) {
          kdma_values.forEach(kdmaItem => {
            if (kdmaItem.kdma && kdmaItem.value !== undefined) {
              kdmaObject[kdmaItem.kdma] = KDMAUtils.normalizeValue(kdmaItem.value);
            }
          });
        }
        
        const entry = {
          scenario: scenarioId,
          scene: sceneId,
          kdma_values: kdmaObject,
          adm: adm.name,
          llm: llm?.model_name || null,
          run_variant: run_variant
        };
        
        entries.push(entry);
        
        const kdmaString = KDMAUtils.serializeToKey(kdmaObject);
        const mapKey = `${scenarioId}:${sceneId}:${kdmaString}:${adm.name}:${llm?.model_name || null}:${run_variant}`;
        
        GlobalState.setParameterRun(mapKey, {
          experimentKey,
          sourceIndex: sceneInfo.source_index,
          inputOutputPath: scenario.input_output.file,
          timingPath: scenario.timing,
          timing_s: sceneInfo.timing_s
        });
      }
    }
  }
  
  
  return entries;
}