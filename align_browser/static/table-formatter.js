// Table formatting functions for displaying experiment data

import { KDMAUtils } from './state.js';

// HTML Templates
const HTML_NA_SPAN = '<span class="na-value">N/A</span>';
const HTML_NO_OPTIONS_SPAN = '<span class="na-value">No options available</span>';
const HTML_NO_SCENE_SPAN = '<span class="na-value">No scene</span>';
const HTML_NO_KDMAS_SPAN = '<span class="na-value">No KDMAs</span>';

// Utility function to escape HTML
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Create expandable content showing only first N lines
export function createExpandableContentWithLines(value, id, maxLines = 3) {
  // Check if this is available from the main app context
  const expandableStates = window.expandableStates || { text: new Map(), objects: new Map() };
  
  const isExpanded = expandableStates.text.get(id) || false;
  const lines = value.split('\n');
  const preview = lines.slice(0, maxLines).join('\n');
  const needsExpansion = lines.length > maxLines;
  
  // If it doesn't need expansion, just return the content with proper formatting
  if (!needsExpansion) {
    return `<span style="white-space: pre-wrap;">${escapeHtml(value)}</span>`;
  }
  
  const shortDisplay = isExpanded ? 'none' : 'inline';
  const fullDisplay = isExpanded ? 'inline' : 'none';
  const buttonText = isExpanded ? 'Show Less' : 'Show More';

  return `<div class="expandable-text" data-full-text="${escapeHtml(value)}" data-param-id="${id}">
    <span id="${id}_short" style="display: ${shortDisplay}; white-space: pre-wrap;">${escapeHtml(preview)}${needsExpansion ? '...' : ''}</span>
    <span id="${id}_full" style="display: ${fullDisplay}; white-space: pre-wrap;">${escapeHtml(value)}</span>
    <button class="show-more-btn" onclick="toggleText('${id}')">${buttonText}</button>
  </div>`;
}

// Create expandable content for long text or objects
export function createExpandableContent(value, id, isLongText = false) {
  const TEXT_PREVIEW_LENGTH = 800;
  
  // Check if this is available from the main app context
  const expandableStates = window.expandableStates || { text: new Map(), objects: new Map() };
  
  const isExpanded = expandableStates[isLongText ? 'text' : 'objects'].get(id) || false;
  const content = isLongText ? value : JSON.stringify(value, null, 2);
  const preview = isLongText ? `${value.substring(0, TEXT_PREVIEW_LENGTH)}...` : getObjectPreview(value);
  
  const shortDisplay = isExpanded ? 'none' : (isLongText ? 'inline' : 'inline');
  const fullDisplay = isExpanded ? (isLongText ? 'inline' : 'block') : 'none';
  const buttonText = isExpanded ? (isLongText ? 'Show Less' : 'Show Preview') : (isLongText ? 'Show More' : 'Show Details');
  const toggleFunction = isLongText ? 'toggleText' : 'toggleObject';
  const shortTag = isLongText ? 'span' : 'span';
  const fullTag = isLongText ? 'span' : 'pre';

  return `<div class="${isLongText ? 'expandable-text' : 'object-display'}" ${isLongText ? `data-full-text="${escapeHtml(content)}"` : ''} data-param-id="${id}">
    <${shortTag} id="${id}_${isLongText ? 'short' : 'preview'}" style="display: ${shortDisplay};">${escapeHtml(preview)}</${shortTag}>
    <${fullTag} id="${id}_full" style="display: ${fullDisplay};">${escapeHtml(content)}</${fullTag}>
    <button class="show-more-btn" onclick="${toggleFunction}('${id}')">${buttonText}</button>
  </div>`;
}

// Helper function to get object preview
export function getObjectPreview(obj) {
  if (!obj) return 'N/A';
  const keys = Object.keys(obj);
  if (keys.length === 0) return '{}';
  if (keys.length === 1) {
    return `${keys[0]}: ${obj[keys[0]]}`;
  }
  return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`;
}

// Create summary text for choice_info sections
export function createChoiceInfoSummary(key, value) {
  switch (key) {
    case 'predicted_kdma_values':
      const choiceCount = Object.keys(value).length;
      const kdmaTypes = new Set();
      Object.values(value).forEach(choiceKdmas => {
        Object.keys(choiceKdmas).forEach(kdma => kdmaTypes.add(kdma));
      });
      return `${choiceCount} choices with ${kdmaTypes.size} KDMA type(s)`;
    
    case 'icl_example_responses':
      const kdmaCount = Object.keys(value).length;
      let totalExamples = 0;
      Object.values(value).forEach(examples => {
        if (Array.isArray(examples)) {
          totalExamples += examples.length;
        }
      });
      return `${kdmaCount} KDMA(s) with ${totalExamples} example(s)`;
    
    default:
      if (typeof value === 'object') {
        const keys = Object.keys(value);
        return `Object with ${keys.length} key(s): ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}`;
      }
      return value.toString().substring(0, 50) + (value.toString().length > 50 ? '...' : '');
  }
}

// Create detailed content for choice_info sections
export function createChoiceInfoDetails(key, value, runId = '') {
  let html = '';
  
  switch (key) {
    case 'predicted_kdma_values':
      Object.entries(value).forEach(([choiceName, kdmaValues]) => {
        html += `<div class="choice-kdma-prediction">
          <div class="choice-name">${escapeHtml(choiceName)}</div>
          <div class="kdma-predictions">`;
        
        Object.entries(kdmaValues).forEach(([kdmaName, values]) => {
          const valueList = Array.isArray(values) ? values : [values];
          html += `<div class="kdma-prediction-item">
            <span class="kdma-name">${escapeHtml(kdmaName)}:</span>
            <span class="kdma-values">[${valueList.map(v => v.toFixed(2)).join(', ')}]</span>
          </div>`;
        });
        
        html += `</div></div>`;
      });
      break;
    
    case 'icl_example_responses':
      Object.entries(value).forEach(([kdmaName, examples]) => {
        html += `<div class="icl-kdma-section">
          <h5 class="icl-kdma-name">${escapeHtml(kdmaName)}</h5>`;
        
        if (Array.isArray(examples)) {
          examples.forEach((example, index) => {
            html += `<div class="icl-example">
              <div class="icl-example-header">Example ${index + 1}</div>`;
            
            if (example.prompt) {
              // Process the prompt text to handle escaped characters and newlines
              const processedPrompt = example.prompt
                .replace(/\\n/g, '\n')
                .replace(/\\"/g, '"')
                .replace(/\\'/g, "'")
                .replace(/\\\\/g, '\\')
                .trim(); // Remove leading/trailing whitespace
              
              const promptId = `icl_prompt_${runId}_${kdmaName}_${index}`;
              html += `<div class="icl-prompt">
                <strong>Prompt:</strong> ${createExpandableContentWithLines(processedPrompt, promptId, 3)}
              </div>`;
            }
            
            if (example.response) {
              html += `<div class="icl-response">
                <strong>Response:</strong>
                <div class="icl-response-content">`;
              
              Object.entries(example.response).forEach(([choiceName, responseData]) => {
                html += `<div class="icl-choice-response">
                  <div class="icl-choice-name">${escapeHtml(choiceName)}</div>
                  <div class="icl-choice-details">
                    <div class="icl-score">Score: ${responseData.score}</div>
                    <div class="icl-reasoning">${escapeHtml(responseData.reasoning || 'No reasoning provided')}</div>
                  </div>
                </div>`;
              });
              
              html += `</div></div>`;
            }
            
            html += `</div>`;
          });
        }
        
        html += `</div>`;
      });
      break;
    
    default:
      if (typeof value === 'object') {
        const objectId = `choice_info_generic_${runId}_${key}`;
        html += createExpandableContent(value, objectId, false);
      } else {
        html += escapeHtml(value.toString());
      }
  }
  
  return html;
}

// Format choice_info object for display with expandable sections
export function formatChoiceInfoValue(choiceInfo, runId = '') {
  if (!choiceInfo || typeof choiceInfo !== 'object') {
    return HTML_NA_SPAN;
  }
  
  const keys = Object.keys(choiceInfo);
  if (keys.length === 0) {
    return HTML_NA_SPAN;
  }
  
  let html = '<div class="choice-info-display">';
  
  // Create expandable section for each top-level key
  keys.forEach(key => {
    const value = choiceInfo[key];
    const summary = createChoiceInfoSummary(key, value);
    const details = createChoiceInfoDetails(key, value, runId);
    const sectionId = `choice_info_section_${runId}_${key}`;
    
    // Determine section class based on key type
    let sectionClass = 'choice-info-generic-section';
    if (key === 'predicted_kdma_values') {
      sectionClass = 'predicted-kdma-section';
    } else if (key === 'icl_example_responses') {
      sectionClass = 'icl-examples-section';
    }
    
    html += `<div class="${sectionClass}">
      <div class="choice-info-section-header">
        <h4 class="choice-info-header">${escapeHtml(key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).replace(/\bIcl\b/g, 'ICL'))}</h4>
        <span id="${sectionId}_summary" class="choice-info-summary">${summary}</span>
        <button class="show-more-btn choice-info-toggle" onclick="toggleChoiceInfoSection('${sectionId}')" id="${sectionId}_button">Show Details</button>
      </div>
      <div id="${sectionId}_details" class="choice-info-details" style="display: none;">
        ${details}
      </div>
    </div>`;
  });
  
  html += '</div>';
  return html;
}

// Toggle function for choice_info sections
function toggleChoiceInfoSection(sectionId) {
  const summarySpan = document.getElementById(`${sectionId}_summary`);
  const detailsDiv = document.getElementById(`${sectionId}_details`);
  const button = document.getElementById(`${sectionId}_button`);
  
  const isCurrentlyExpanded = detailsDiv.style.display !== 'none';
  const newExpanded = !isCurrentlyExpanded;
  
  if (newExpanded) {
    summarySpan.style.display = 'none';
    detailsDiv.style.display = 'block';
    button.textContent = 'Show Less';
  } else {
    summarySpan.style.display = 'inline';
    detailsDiv.style.display = 'none';
    button.textContent = 'Show Details';
  }
  
  // Save state for persistence (access global expandableStates if available)
  if (window.expandableStates && window.expandableStates.objects) {
    window.expandableStates.objects.set(sectionId, newExpanded);
  }
}



// One-time parameter propagation function
function propagateParameterValue(paramName, sourceRunId) {
  // This function will be called from the global scope, so we need to access the app state
  if (window.appState && window.getParameterValueFromRun && window.propagateParameterToAllRuns) {
    const sourceRun = window.appState.pinnedRuns.get(sourceRunId);
    if (sourceRun) {
      const value = window.getParameterValueFromRun(sourceRun, paramName);
      window.propagateParameterToAllRuns(paramName, value, sourceRunId);
    }
  }
}

// Make functions globally available for onclick handlers
window.toggleChoiceInfoSection = toggleChoiceInfoSection;
window.propagateParameterValue = propagateParameterValue;

// Constants
const TEXT_PREVIEW_LENGTH = 800;
const FLOATING_POINT_TOLERANCE = 0.001;

// Format KDMA value consistently across the application
export function formatKDMAValue(value) {
  return KDMAUtils.formatValue(value);
}

// Format KDMA association bar for choice display
export function formatKDMAAssociationBar(kdma, val) {
  const percentage = Math.round(val * 100);
  const color = val >= 0.7 ? '#28a745' : val >= 0.4 ? '#ffc107' : '#dc3545';
  return `<div class="kdma-bar">
    <span class="kdma-name">${kdma}</span>
    <div class="kdma-bar-container">
      <div class="kdma-bar-fill" style="width: ${percentage}%; background-color: ${color};"></div>
    </div>
    <span class="kdma-value">${val.toFixed(2)}</span>
  </div>`;
}

// Format single choice item with KDMA associations
export function formatChoiceItem(choice) {
  let html = `<div class="choice-card">
    <div class="choice-text">${escapeHtml(choice.unstructured || choice.description || 'No description')}</div>`;
  
  // Add KDMA associations if available
  if (choice.kdma_association) {
    html += '<div class="kdma-bars">';
    html += '<div class="kdma-truth-header">KDMA Association Truth</div>';
    Object.entries(choice.kdma_association).forEach(([kdma, val]) => {
      html += formatKDMAAssociationBar(kdma, val);
    });
    html += '</div>';
  }
  html += '</div>';
  return html;
}

// Format choices array for display
export function formatChoicesValue(choices) {
  if (!Array.isArray(choices)) {
    return escapeHtml(choices.toString());
  }
  
  let html = '<div class="choices-display">';
  choices.forEach((choice) => {
    html += formatChoiceItem(choice);
  });
  html += '</div>';
  return html;
}

// Format KDMA values object for display
export function formatKDMAValuesObject(kdmaObject) {
  const kdmaEntries = Object.entries(kdmaObject);
  if (kdmaEntries.length === 0) {
    return HTML_NO_KDMAS_SPAN;
  }
  
  let html = '<div class="kdma-values-display">';
  kdmaEntries.forEach(([kdmaName, kdmaValue]) => {
    html += `<div class="kdma-value-item">
      <span class="kdma-name">${escapeHtml(kdmaName)}:</span>
      <span class="kdma-number">${formatKDMAValue(kdmaValue)}</span>
    </div>`;
  });
  html += '</div>';
  return html;
}

// Compare values with proper handling for different types
export function compareValues(val1, val2) {
  if (val1 === val2) return true;
  
  // Handle null/undefined cases
  if (val1 == null || val2 == null) {
    return val1 == val2;
  }
  
  // Handle numeric comparison with floating point tolerance
  if (typeof val1 === 'number' && typeof val2 === 'number') {
    return Math.abs(val1 - val2) < FLOATING_POINT_TOLERANCE;
  }
  
  // Handle string comparison
  if (typeof val1 === 'string' && typeof val2 === 'string') {
    return val1 === val2;
  }
  
  // Handle array comparison
  if (Array.isArray(val1) && Array.isArray(val2)) {
    if (val1.length !== val2.length) return false;
    for (let i = 0; i < val1.length; i++) {
      if (!compareValues(val1[i], val2[i])) return false;
    }
    return true;
  }
  
  // Handle object comparison
  const keys1 = Object.keys(val1);
  const keys2 = Object.keys(val2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!compareValues(val1[key], val2[key])) return false;
  }
  return true;
}

// Main value formatting function for table cells
export function formatValue(value, type, paramName = '', runId = '', pinnedRuns = null) {
  if (value === null || value === undefined || value === 'N/A') {
    return HTML_NA_SPAN;
  }
  
  // Handle dropdown parameters for pinned runs
  if (runId !== '' && pinnedRuns && PARAMETER_DROPDOWN_HANDLERS[paramName]) {
    const handler = PARAMETER_DROPDOWN_HANDLERS[paramName];
    const formattedValue = handler(runId, value, pinnedRuns);
    
    
    return formattedValue;
  }
  
  switch (type) {
    case 'number':
      return typeof value === 'number' ? value.toFixed(3) : value.toString();
    
    case 'longtext':
      if (typeof value === 'string' && value.length > TEXT_PREVIEW_LENGTH) {
        const id = `text_${paramName}_${runId}_${type}`;
        return createExpandableContent(value, id, true);
      }
      return escapeHtml(value.toString());
    
    case 'text':
      return escapeHtml(value.toString());
    
    case 'choices':
      return formatChoicesValue(value);
    
    case 'choice_info':
      return formatChoiceInfoValue(value, runId);
    
    case 'kdma_values':
      return formatKDMAValuesObject(value);
    
    case 'object':
      const id = `object_${paramName}_${runId}_${type}`;
      return createExpandableContent(value, id, false);
    
    default:
      return escapeHtml(value.toString());
  }
}

// CSS Classes for dropdowns
const CSS_TABLE_LLM_SELECT = 'table-llm-select';
const CSS_TABLE_ADM_SELECT = 'table-adm-select';
const CSS_TABLE_SCENARIO_SELECT = 'table-scenario-select';
const CSS_TABLE_RUN_VARIANT_SELECT = 'table-run-variant-select';

// Generic dropdown creation function
export function createDropdownForRun(runId, currentValue, options, pinnedRuns) {
  const { 
    optionsPath, 
    cssClass, 
    onChangeHandler,
    noOptionsMessage = null,
    preCondition = null
  } = options;
  
  const run = pinnedRuns.get(runId);
  if (!run) return escapeHtml(currentValue);
  
  // Check pre-condition if provided
  if (preCondition && !preCondition(run)) {
    return noOptionsMessage || HTML_NA_SPAN;
  }
  
  // Get options from the specified path in run.availableOptions
  const availableOptions = optionsPath.split('.').reduce((obj, key) => obj?.[key], run.availableOptions);
  if (!availableOptions || availableOptions.length === 0) {
    return noOptionsMessage || HTML_NO_OPTIONS_SPAN;
  }
  
  const sortedOptions = [...availableOptions].sort();
  
  // Always include the current value even if it's not in the available options
  let currentValueIsInvalid = false;
  if (currentValue && !sortedOptions.includes(currentValue)) {
    sortedOptions.push(currentValue);
    sortedOptions.sort();
    currentValueIsInvalid = true;
  }
  
  // Always disable dropdowns when there are few options (excluding invalid current value)
  const isDisabled = availableOptions.length <= 1;
  const disabledAttr = isDisabled ? 'disabled' : '';
  
  let html = `<select class="${cssClass}" ${disabledAttr} onchange="${onChangeHandler}('${runId}', this.value)">`;
  sortedOptions.forEach(option => {
    const selected = option === currentValue ? 'selected' : '';
    const isCurrentInvalidValue = currentValueIsInvalid && option === currentValue;
    const optionClass = isCurrentInvalidValue ? 'class="invalid-option"' : '';
    const optionTitle = isCurrentInvalidValue ? 'title="No matching experiment for this value"' : '';
    html += `<option value="${escapeHtml(option)}" ${selected} ${optionClass} ${optionTitle}>${escapeHtml(option)}</option>`;
  });
  html += '</select>';
  
  return html;
}

// Dropdown configuration for different parameter types
const DROPDOWN_CONFIGS = {
  llm: {
    optionsPath: 'llms',
    cssClass: CSS_TABLE_LLM_SELECT,
    onChangeHandler: 'handleRunLLMChange'
  },
  adm: {
    optionsPath: 'admTypes',
    cssClass: CSS_TABLE_ADM_SELECT,
    onChangeHandler: 'handleRunADMChange'
  },
  scene: {
    optionsPath: 'scenes',
    cssClass: CSS_TABLE_SCENARIO_SELECT,
    onChangeHandler: 'handleRunSceneChange'
  },
  scenario: {
    optionsPath: 'scenarios',
    cssClass: CSS_TABLE_SCENARIO_SELECT,
    onChangeHandler: 'handleRunScenarioChange',
    preCondition: (run) => run.scene,
    noOptionsMessage: HTML_NO_SCENE_SPAN
  }
};

// Generic dropdown creation factory
export function createDropdownForParameter(parameterType) {
  return (runId, currentValue, pinnedRuns) => {
    const config = DROPDOWN_CONFIGS[parameterType];
    return createDropdownForRun(runId, currentValue, config, pinnedRuns);
  };
}

// Create dropdown functions using the factory
export const createLLMDropdownForRun = createDropdownForParameter('llm');
export const createADMDropdownForRun = createDropdownForParameter('adm');
export const createSceneDropdownForRun = createDropdownForParameter('scene');
export const createSpecificScenarioDropdownForRun = createDropdownForParameter('scenario');

// Create dropdown HTML for run variant selection in table cells
export function createRunVariantDropdownForRun(runId, currentValue, pinnedRuns) {
  const run = pinnedRuns.get(runId);
  if (!run) return escapeHtml(currentValue);
  
  // Use the run's actual runVariant to ensure correct selection after parameter updates
  const actualCurrentValue = run.runVariant;
  
  return createDropdownForRun(runId, actualCurrentValue, {
    optionsPath: 'runVariants',
    cssClass: CSS_TABLE_RUN_VARIANT_SELECT,
    onChangeHandler: 'handleRunVariantChange'
  }, pinnedRuns);
}

// Parameter-specific dropdown handlers
export const PARAMETER_DROPDOWN_HANDLERS = {
  'run_variant': createRunVariantDropdownForRun,
  'llm_backbone': createLLMDropdownForRun,
  'adm_type': createADMDropdownForRun,
  'scene': createSceneDropdownForRun,
  'scenario': createSpecificScenarioDropdownForRun,
  'kdma_values': createKDMAControlsForRun
};

// KDMA utility functions - these require access to KDMAUtils for deep comparison
// Get max KDMAs allowed for a specific run based on its constraints and current selections
export function getMaxKDMAsForRun(runId, pinnedRuns) {
  const run = pinnedRuns.get(runId);
  if (!run) return 0;
  
  const kdmaOptions = run.availableOptions?.kdmaValues;
  if (!kdmaOptions || !kdmaOptions.validCombinations) {
    return 1; // Default to at least 1 KDMA if no options available
  }
  
  // Find the maximum number of KDMAs in any valid combination
  let maxKDMAs = 0;
  kdmaOptions.validCombinations.forEach(combination => {
    maxKDMAs = Math.max(maxKDMAs, Object.keys(combination).length);
  });
  
  return Math.max(maxKDMAs, 1); // At least 1 KDMA should be possible
}

// Get minimum required KDMAs for a run - if all combinations have the same count, return that count
export function getMinimumRequiredKDMAs(runId, pinnedRuns) {
  const run = pinnedRuns.get(runId);
  if (!run?.availableOptions?.kdmaValues?.validCombinations) {
    return 1; // Default to 1 if no options available
  }
  
  const combinations = run.availableOptions.kdmaValues.validCombinations;
  if (combinations.length === 0) {
    return 1;
  }
  
  // Filter out empty combinations (unaligned cases with 0 KDMAs)
  const nonEmptyCombinations = combinations.filter(combination => Object.keys(combination).length > 0);
  
  if (nonEmptyCombinations.length === 0) {
    return 1; // Only empty combinations available
  }
  
  // Get the count of KDMAs in each non-empty combination
  const kdmaCounts = nonEmptyCombinations.map(combination => Object.keys(combination).length);
  
  // Check if all non-empty combinations have the same number of KDMAs
  const firstCount = kdmaCounts[0];
  const allSameCount = kdmaCounts.every(count => count === firstCount);
  
  if (allSameCount && firstCount > 1) {
    return firstCount; // All non-empty combinations require the same number > 1
  }
  return 1; // Either mixed counts or all require 1, use single-add behavior
}

// Get valid KDMAs for a specific run
export function getValidKDMAsForRun(runId, pinnedRuns) {
  const run = pinnedRuns.get(runId);
  if (!run?.availableOptions?.kdmaValues?.validCombinations) {
    return {};
  }
  
  // Extract all available types and values from valid combinations
  const availableOptions = {};
  run.availableOptions.kdmaValues.validCombinations.forEach(combination => {
    Object.entries(combination).forEach(([kdmaType, value]) => {
      if (!availableOptions[kdmaType]) {
        availableOptions[kdmaType] = new Set();
      }
      availableOptions[kdmaType].add(value);
    });
  });
  
  return availableOptions;
}

// Get valid KDMA types that can be selected for a specific run  
export function getValidKDMATypesForRun(runId, currentKdmaType, currentKDMAs, pinnedRuns) {
  const run = pinnedRuns.get(runId);
  if (!run?.availableOptions?.kdmaValues?.validCombinations) {
    return [currentKdmaType]; // Fallback to just current type
  }
  
  const validTypes = new Set([currentKdmaType]); // Always include current type
  
  // For each unused KDMA type, check if replacing current type would create valid combination
  const availableKDMAs = getValidKDMAsForRun(runId, pinnedRuns);
  Object.keys(availableKDMAs).forEach(kdmaType => {
    // Skip if this type is already used (except current one we're replacing)
    if (kdmaType !== currentKdmaType && currentKDMAs[kdmaType] !== undefined) {
      return;
    }
    
    // Test if this type can be used by checking valid combinations
    const testKDMAs = { ...currentKDMAs };
    delete testKDMAs[currentKdmaType]; // Remove current type
    
    // If we're adding a different type, add it with any valid value
    if (kdmaType !== currentKdmaType) {
      const validValues = Array.from(availableKDMAs[kdmaType] || []);
      if (validValues.length > 0) {
        testKDMAs[kdmaType] = validValues[0]; // Use first valid value for testing
      }
    }
    
    // Check if this combination exists in validCombinations
    const isValidCombination = run.availableOptions.kdmaValues.validCombinations.some(combination => {
      return KDMAUtils.deepEqual(testKDMAs, combination);
    });
    
    if (isValidCombination) {
      validTypes.add(kdmaType);
    }
  });
  
  return Array.from(validTypes).sort();
}

// Check if a specific KDMA can be removed from a run
export function canRemoveSpecificKDMA(runId, kdmaType, pinnedRuns) {
  const run = pinnedRuns.get(runId);
  if (!run) return false;
  
  const currentKDMAs = run.kdmaValues || {};
  const kdmaOptions = run.availableOptions?.kdmaValues;
  if (!kdmaOptions || !kdmaOptions.validCombinations) {
    return false;
  }
  
  // Create a copy of current KDMAs without the one we want to remove
  const remainingKDMAs = { ...currentKDMAs };
  delete remainingKDMAs[kdmaType];
  
  // Check if the remaining KDMA combination exists in validCombinations
  const hasValidRemaining = kdmaOptions.validCombinations.some(combination => {
    return KDMAUtils.deepEqual(remainingKDMAs, combination);
  });
  
  if (hasValidRemaining) {
    return true; // Normal case - remaining combination is valid
  }
  
  // Special case: If empty combination {} is valid (unaligned case), 
  // allow removal of any KDMA (will result in clearing all KDMAs)
  const hasEmptyOption = kdmaOptions.validCombinations.some(combination => {
    return Object.keys(combination).length === 0;
  });
  
  if (hasEmptyOption) {
    return true;
  }
  
  return false;
}

// Check if we can add another KDMA given current KDMA values
export function canAddKDMAToRun(runId, currentKDMAs, pinnedRuns) {
  const run = pinnedRuns.get(runId);
  if (!run?.availableOptions?.kdmaValues?.validCombinations) {
    return false;
  }
  
  const currentKDMAEntries = Object.entries(currentKDMAs || {});
  const maxKDMAs = getMaxKDMAsForRun(runId, pinnedRuns);
  
  // First check if we're already at max
  if (currentKDMAEntries.length >= maxKDMAs) {
    return false;
  }
  
  // Check if there are any valid combinations that:
  // 1. Include all current KDMAs with their exact values
  // 2. Have at least one additional KDMA
  return run.availableOptions.kdmaValues.validCombinations.some(combination => {
    
    const combinationKeys = Object.keys(combination);
    if (combinationKeys.length <= currentKDMAEntries.length) {
      return false;
    }
    
    // Check if this combination includes all current KDMAs with matching values
    return currentKDMAEntries.every(([kdmaType, value]) => {
      return combination.hasOwnProperty(kdmaType) && 
             Math.abs(combination[kdmaType] - value) < FLOATING_POINT_TOLERANCE;
    });
  });
}

// Create KDMA controls HTML for table cells
export function createKDMAControlsForRun(runId, currentKDMAs, pinnedRuns) {
  const run = pinnedRuns.get(runId);
  if (!run) return HTML_NA_SPAN;
  
  const currentKDMAEntries = Object.entries(currentKDMAs || {});
  const canAddMore = canAddKDMAToRun(runId, currentKDMAs, pinnedRuns);
  
  let html = `<div class="table-kdma-container" data-run-id="${runId}">`;
  
  // Render existing KDMA controls
  currentKDMAEntries.forEach(([kdmaType, value]) => {
    html += createSingleKDMAControlForRun(runId, kdmaType, value, pinnedRuns);
  });
  
  // Add button - always show but enable/disable based on availability
  const disabledAttr = canAddMore ? '' : 'disabled';
  
  // Determine tooltip text for disabled state
  let tooltipText = '';
  if (!canAddMore) {
    tooltipText = 'title="No valid KDMA combinations available with current values"';
  }
  
  html += `<button class="add-kdma-btn" onclick="addKDMAToRun('${runId}')" 
             ${disabledAttr} ${tooltipText}
             style="margin-top: 5px; font-size: 12px; padding: 2px 6px;">
             Add KDMA
           </button>`;
  
  html += '</div>';
  return html;
}

// Create individual KDMA control for table cell
export function createSingleKDMAControlForRun(runId, kdmaType, value, pinnedRuns) {
  const availableKDMAs = getValidKDMAsForRun(runId, pinnedRuns);
  const run = pinnedRuns.get(runId);
  const currentKDMAs = run.kdmaValues || {};
  
  // Get available types (only those that can form valid combinations)
  const availableTypes = getValidKDMATypesForRun(runId, kdmaType, currentKDMAs, pinnedRuns);
  
  const validValues = Array.from(availableKDMAs[kdmaType] || []);
  
  // Ensure current value is in the list (in case of data inconsistencies)
  if (value !== undefined && value !== null) {
    // Check with tolerance for floating point
    const hasValue = validValues.some(v => Math.abs(v - value) < FLOATING_POINT_TOLERANCE);
    if (!hasValue) {
      // Add current value and sort
      validValues.push(value);
      validValues.sort((a, b) => a - b);
    }
  }
  
  // Sort valid values to ensure proper order
  validValues.sort((a, b) => a - b);
  
  // Calculate slider properties from valid values
  const minVal = validValues.length > 0 ? Math.min(...validValues) : 0;
  const maxVal = validValues.length > 0 ? Math.max(...validValues) : 1;
  
  // Calculate step as smallest difference between consecutive values, or 0.1 if only one value
  let step = 0.1;
  if (validValues.length > 1) {
    const diffs = [];
    for (let i = 1; i < validValues.length; i++) {
      diffs.push(validValues[i] - validValues[i-1]);
    }
    step = Math.min(...diffs);
  }
  
  // Always disable KDMA type dropdown when there are few options
  const isDisabled = availableTypes.length <= 1;
  const disabledAttr = isDisabled ? 'disabled' : '';

  return `
    <div class="table-kdma-control">
      <select class="table-kdma-type-select" ${disabledAttr}
              onchange="handleRunKDMATypeChange('${runId}', '${kdmaType}', this.value)">
        ${availableTypes.map(type => 
          `<option value="${type}" ${type === kdmaType ? 'selected' : ''}>${type}</option>`
        ).join('')}
      </select>
      
      <input type="range" 
             class="table-kdma-value-slider"
             id="kdma-slider-${runId}-${kdmaType}"
             min="${minVal}" max="${maxVal}" step="${step}" 
             value="${value}"
             oninput="handleRunKDMASliderInput('${runId}', '${kdmaType}', this)">
      <span class="table-kdma-value-display" id="kdma-value-${runId}-${kdmaType}">${formatKDMAValue(value)}</span>
      
      <button class="table-kdma-remove-btn" 
              onclick="removeKDMAFromRun('${runId}', '${kdmaType}')" 
              ${!canRemoveSpecificKDMA(runId, kdmaType, pinnedRuns) ? 'disabled' : ''}
              title="${!canRemoveSpecificKDMA(runId, kdmaType, pinnedRuns) ? 'No valid experiments exist without this KDMA' : 'Remove KDMA'}">×</button>
    </div>
  `;
}