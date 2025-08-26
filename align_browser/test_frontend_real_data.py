#!/usr/bin/env python3
"""
Frontend tests using real experiment data.

These tests require real experiment data in experiment-data/phase2_june/
and will be skipped if the data is not available.
"""

from playwright.sync_api import expect
from .conftest import (
    wait_for_new_experiment_result,
    ensure_select_value,
    ensure_dropdown_selection,
)


def wait_for_run_results_loaded(page, timeout=3000):
    """Wait for run results to be loaded by checking for actual experiment data."""
    page.wait_for_function(
        """() => {
            const probeTimeCells = document.querySelectorAll('tr[data-parameter="probe_time"] td');
            const justificationCells = document.querySelectorAll('tr[data-parameter="justification"] td');
            // Should have at least 2 cells (parameter name + value) and value should not be empty
            return probeTimeCells.length > 1 && justificationCells.length > 1 &&
                   probeTimeCells[1].textContent.trim() !== '' &&
                   justificationCells[1].textContent.trim() !== '';
        }""",
        timeout=timeout,
    )


def get_experiment_data(page):
    """Helper to get probe time, justification, and decision from current experiment."""
    result = {}

    # Get probe time
    probe_time_cells = page.locator('tr[data-parameter="probe_time"] td').all()
    if len(probe_time_cells) > 1:
        result["probe_time"] = probe_time_cells[1].text_content().strip()

    # Get justification (first 100 chars to avoid truncation differences)
    justification_cells = page.locator('tr[data-parameter="justification"] td').all()
    if len(justification_cells) > 1:
        full_justification = justification_cells[1].text_content().strip()
        result["justification"] = full_justification[:100] if full_justification else ""

    # Get decision/action
    action_cells = page.locator('tr[data-parameter="action"] td').all()
    if len(action_cells) > 1:
        result["action"] = action_cells[1].text_content().strip()

    return result


def test_adm_selection_updates_llm(page, real_data_test_server):
    """Test that selecting an ADM type updates the LLM dropdown and changes experiment data."""
    page.goto(real_data_test_server)

    # Wait for table to load
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_function(
        "document.querySelectorAll('.table-adm-select').length > 0", timeout=10000
    )

    llm_select = page.locator(".table-llm-select").first

    # Use utility function to ensure ADM selection and wait for experiment to change
    ensure_select_value(page, ".table-adm-select", "pipeline_baseline")

    # Check that LLM dropdown has options
    expect(llm_select).to_be_visible()
    llm_options = llm_select.locator("option").all()
    assert len(llm_options) > 0, "LLM dropdown should have options after ADM selection"


def test_kdma_sliders_interaction(page, real_data_test_server):
    """Test that KDMA sliders are interactive and snap to valid values."""
    page.goto(real_data_test_server)

    # Wait for table to load
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_function(
        "document.querySelectorAll('.table-adm-select').length > 0", timeout=10000
    )

    # Set ADM type to enable KDMA sliders
    adm_select = page.locator(".table-adm-select").first
    adm_select.select_option("pipeline_baseline")
    # Wait for UI to update after ADM selection
    page.wait_for_load_state("networkidle")

    # Find KDMA sliders in table
    sliders = page.locator(".table-kdma-value-slider").all()

    if sliders:
        slider = sliders[0]
        value_span = slider.locator("xpath=following-sibling::span[1]")

        # Get initial value
        initial_value = value_span.text_content()

        # Use context manager to wait for experiment data to change
        with wait_for_new_experiment_result(page):
            # Try to change slider value - it should snap to nearest valid value
            slider.evaluate("slider => slider.value = '0.7'")
            slider.dispatch_event("input")
        # Context manager automatically waits for experiment key to change

        new_value = value_span.text_content()
        # Value should change from initial (validation may snap it to valid value)
        assert new_value != initial_value or float(new_value) in [
            0.0,
            0.1,
            0.2,
            0.3,
            0.4,
            0.5,
            0.6,
            0.7,
            0.8,
            0.9,
            1.0,
        ], f"Slider value should be valid decimal, got {new_value}"


def test_scenario_selection_availability(page, real_data_test_server):
    """Test that scenario selection becomes available after parameter selection."""
    page.goto(real_data_test_server)

    # Wait for table to load
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_function(
        "document.querySelectorAll('.table-adm-select').length > 0", timeout=10000
    )

    # Make selections
    adm_select = page.locator(".table-adm-select").first
    adm_select.select_option("pipeline_baseline")

    # Wait for scenario dropdown to populate after ADM selection
    page.wait_for_function(
        "document.querySelector('.table-scenario-select option:not([value=\"\"])') !== null",
        timeout=3000,
    )

    # Check scenario dropdown in table
    scenario_select = page.locator(".table-scenario-select").first
    expect(scenario_select).to_be_visible()

    # It should either have options or be disabled with a message
    if scenario_select.is_enabled():
        scenario_options = scenario_select.locator("option").all()
        assert len(scenario_options) > 0, (
            "Enabled scenario dropdown should have options"
        )
    else:
        # If disabled, it should have a "no scenarios" message
        disabled_option = scenario_select.locator("option").first
        expect(disabled_option).to_contain_text("No scenarios available")


def test_dynamic_kdma_management(page, real_data_test_server):
    """Test dynamic KDMA addition, removal, and type selection."""
    page.goto(real_data_test_server)

    # Wait for table to load
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_function(
        "document.querySelectorAll('.table-adm-select').length > 0", timeout=10000
    )

    # Select ADM and LLM to enable KDMA functionality
    adm_select = page.locator(".table-adm-select").first
    adm_select.select_option("pipeline_baseline")
    # Wait for KDMA controls to appear after ADM selection
    page.wait_for_function(
        "document.querySelectorAll('.table-kdma-value-slider').length > 0", timeout=3000
    )

    # Check KDMA controls in table
    kdma_sliders = page.locator(".table-kdma-value-slider")
    initial_count = kdma_sliders.count()

    # Should have KDMA sliders available in the table
    assert initial_count > 0, "Should have KDMA sliders in table after ADM selection"

    # Check KDMA slider functionality
    if initial_count > 0:
        first_slider = kdma_sliders.first
        expect(first_slider).to_be_visible()

        # Test slider interaction
        first_slider.fill("0.7")
        page.wait_for_timeout(500)

        new_value = first_slider.input_value()
        assert new_value == "0.7", "KDMA slider should update value"


def test_kdma_selection_shows_results_regression(page, real_data_test_server):
    """Test that KDMA sliders work correctly in the table-based UI."""
    page.goto(real_data_test_server)

    # Wait for page to load
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_function(
        "document.querySelectorAll('.table-adm-select').length > 0", timeout=10000
    )

    # Test basic table-based KDMA functionality
    adm_select = page.locator(".table-adm-select").first

    # Select pipeline_baseline to enable KDMA sliders
    adm_select.select_option("pipeline_baseline")
    # Wait for KDMA controls to appear after ADM selection
    page.wait_for_function(
        "document.querySelectorAll('.table-kdma-value-slider').length > 0", timeout=3000
    )

    # Check for KDMA sliders in the table
    kdma_sliders = page.locator(".table-kdma-value-slider")
    slider_count = kdma_sliders.count()

    if slider_count > 0:
        print(f"Testing {slider_count} KDMA sliders")

        # Test that sliders are functional
        first_slider = kdma_sliders.first
        first_slider.fill("0.7")
        page.wait_for_timeout(500)

        # Verify slider works
        assert first_slider.input_value() == "0.7", "KDMA slider should be functional"

        # Verify table remains functional
        expect(page.locator(".comparison-table")).to_be_visible()
        print("✓ KDMA functionality test passed")
    else:
        print("No KDMA sliders found - test passes")


def test_real_data_scenario_availability(page, real_data_test_server):
    """Test that scenarios are available with real data."""
    page.goto(real_data_test_server)

    # Wait for table to load
    page.wait_for_selector(".comparison-table", timeout=10000)

    # For real data, we should have some data loaded
    # Even if no specific scenario elements, the table should be populated
    table_rows = page.locator(".comparison-table tbody tr")
    assert table_rows.count() > 0, "Should have data rows in the comparison table"


def test_real_data_comprehensive_loading(page, real_data_test_server):
    """Test comprehensive loading of real experiment data."""
    page.goto(real_data_test_server)

    # Wait for page to fully load
    page.wait_for_load_state("networkidle")

    # Check for no JavaScript errors
    js_errors = []
    page.on(
        "console",
        lambda msg: js_errors.append(msg.text) if msg.type == "error" else None,
    )

    # Wait for table to load
    page.wait_for_selector(".comparison-table", timeout=10000)

    # Wait for async operations to complete
    wait_for_run_results_loaded(page)

    # Check that we have minimal expected elements
    expect(page.locator(".comparison-table")).to_be_visible()

    # Filter out known acceptable errors
    filtered_errors = [
        error
        for error in js_errors
        if not any(
            acceptable in error.lower()
            for acceptable in ["favicon", "manifest", "workbox", "service worker"]
        )
    ]

    assert len(filtered_errors) == 0, f"Found JavaScript errors: {filtered_errors}"


def test_kdma_combination_default_value_issue(page, real_data_test_server):
    """Test the KDMA combination issue where adding a second KDMA defaults to 0.5 instead of valid value."""
    page.goto(real_data_test_server)

    # Wait for table to load
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_function(
        "document.querySelectorAll('.table-adm-select').length > 0", timeout=10000
    )

    ensure_dropdown_selection(page, ".table-adm-select", "pipeline_baseline", "ADM")

    # For LLM, we need to check what's actually available since it might vary
    llm_select = page.locator(".table-llm-select").first
    current_llm = llm_select.input_value()
    print(f"Using LLM: {current_llm}")
    # Don't enforce a specific LLM since availability may vary with test data

    # Select June2025-AF-train scenario to get multi-KDMA support
    scenario_select = page.locator(".table-scenario-select").first

    # Check what scenarios are available
    scenario_options = scenario_select.locator("option").all()
    scenario_values = [
        opt.get_attribute("value")
        for opt in scenario_options
        if opt.get_attribute("value")
    ]
    print(f"Available scenarios: {scenario_values}")

    # Find a June2025-AF-train scenario (required for this test)
    june_scenarios = [s for s in scenario_values if "June2025-AF-train" in s]
    assert len(june_scenarios) > 0, (
        f"June2025-AF-train scenarios required for this test, but only found: {scenario_values}"
    )

    scenario_select.select_option(june_scenarios[0])
    # Wait for scenario selection to take effect and results to load
    wait_for_run_results_loaded(page)

    # Set initial KDMA slider to a valid value to enable adding another KDMA
    initial_kdma_slider = page.locator(".table-kdma-value-slider").first

    with wait_for_new_experiment_result(page):
        initial_kdma_slider.evaluate("slider => slider.value = '1'")
        initial_kdma_slider.dispatch_event("input")
    # Wait for results to load after KDMA change

    # Check initial KDMA sliders - should have affiliation already
    kdma_sliders = page.locator(".table-kdma-value-slider")
    initial_count = kdma_sliders.count()

    # Should have at least one KDMA slider initially
    assert initial_count > 0, "Should have initial KDMA slider"

    # Look for "Add KDMA" button
    add_kdma_button = page.locator(".add-kdma-btn")

    # This test requires the ability to add a second KDMA
    assert add_kdma_button.count() > 0, (
        "Add KDMA button must be available for this test"
    )
    # Click Add KDMA button to add second KDMA
    with wait_for_new_experiment_result(page):
        add_kdma_button.click()

    # Wait for new KDMA slider to be added by checking for count increase
    page.wait_for_function(
        f"document.querySelectorAll('.table-kdma-value-slider').length > {initial_count}",
        timeout=5000,
    )

    # Check that a new KDMA slider was added
    updated_kdma_sliders = page.locator(".table-kdma-value-slider")
    updated_count = updated_kdma_sliders.count()

    assert updated_count > initial_count, "Should have added a new KDMA slider"

    # Check the value of the new slider
    new_sliders = updated_kdma_sliders.all()
    if len(new_sliders) > 1:
        # Get the last slider (newly added)
        new_slider = new_sliders[-1]
        new_value = new_slider.input_value()

        # This is the bug: it defaults to 0.5 instead of a valid value
        # For pipeline_baseline with affiliation+merit, valid combinations are only 0.0 and 1.0
        # So 0.5 should not be the default - it should be 0.0 or 1.0
        valid_values = ["0.0", "1.0"]

        # This assertion should fail with current code, proving the bug exists
        # Accept both integer and decimal formats
        valid_values = ["0.0", "1.0", "0", "1"]
        assert new_value in valid_values, (
            f"New KDMA slider should default to valid value (0.0 or 1.0), but got {new_value}"
        )

    # Also check that the dropdowns don't go blank
    adm_select = page.locator(".table-adm-select").first
    adm_select_value = adm_select.input_value()
    assert adm_select_value != "", "ADM select should not go blank after adding KDMA"

    scenario_select_value = scenario_select.input_value()
    assert scenario_select_value != "", (
        "Scenario select should not go blank after adding KDMA"
    )
    assert "June2025-AF-train" in scenario_select_value, (
        "Should still have June2025-AF-train scenario selected"
    )


def test_kdma_delete_button_enabled_after_adding_second_kdma(
    page, real_data_test_server
):
    """Test that KDMA delete buttons become enabled after adding a second KDMA when valid single-KDMA experiments exist."""
    page.goto(real_data_test_server)

    # Wait for table to load
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_function(
        "document.querySelectorAll('.table-adm-select').length > 0", timeout=10000
    )

    # Select pipeline_baseline ADM to enable KDMA functionality
    adm_select = page.locator(".table-adm-select").first
    adm_select.select_option("pipeline_baseline")
    page.wait_for_load_state("networkidle")

    # Select June2025-AF-train scenario to get multi-KDMA support
    scenario_select = page.locator(".table-scenario-select").first

    # Check what scenarios are available
    scenario_options = scenario_select.locator("option").all()
    scenario_values = [
        opt.get_attribute("value")
        for opt in scenario_options
        if opt.get_attribute("value")
    ]

    # Find a June2025-AF-train scenario (required for this test)
    june_scenarios = [s for s in scenario_values if "June2025-AF-train" in s]
    assert len(june_scenarios) > 0, (
        f"June2025-AF-train scenarios required for this test, but only found: {scenario_values}"
    )

    scenario_select.select_option(june_scenarios[0])
    page.wait_for_load_state("networkidle")
    wait_for_run_results_loaded(page)

    # Set initial KDMA slider to a valid value to enable adding another KDMA
    initial_kdma_slider = page.locator(".table-kdma-value-slider").first

    with wait_for_new_experiment_result(page):
        initial_kdma_slider.evaluate("slider => slider.value = '1'")
        initial_kdma_slider.dispatch_event("input")

    page.wait_for_load_state("networkidle")

    # Check initial KDMA delete buttons - should be disabled with single KDMA
    initial_delete_buttons = page.locator(".table-kdma-remove-btn")
    initial_delete_count = initial_delete_buttons.count()

    # This test requires at least one initial delete button
    assert initial_delete_count > 0, (
        "Should have at least one delete button with initial KDMA"
    )

    initial_button = initial_delete_buttons.first
    initial_disabled = initial_button.is_disabled()
    print(f"Initial delete button disabled: {initial_disabled}")

    # With single KDMA, delete button should be disabled (can't remove all KDMAs)
    assert initial_disabled, "Delete button should be disabled with single KDMA"

    # Look for "Add KDMA" button
    add_kdma_button = page.locator(".add-kdma-btn")

    # This test requires the ability to add a second KDMA
    assert add_kdma_button.count() > 0, (
        "Add KDMA button must be available for this test"
    )

    # Ensure the button is enabled before clicking
    expect(add_kdma_button).to_be_enabled()

    # Click Add KDMA button to add second KDMA
    with wait_for_new_experiment_result(page):
        add_kdma_button.click()

    # Wait for new KDMA slider to be added
    page.wait_for_function(
        "document.querySelectorAll('.table-kdma-value-slider').length > 1", timeout=5000
    )

    # Now check delete buttons after adding second KDMA
    updated_delete_buttons = page.locator(".table-kdma-remove-btn")
    updated_delete_count = updated_delete_buttons.count()

    assert updated_delete_count > 1, "Should have delete buttons for multiple KDMAs"

    # Check delete button states for asymmetric KDMA deletion
    # With two KDMAs (affiliation + merit) for June2025-AF-train scenario:
    # - affiliation alone: experiments exist for this scenario ✅
    # - merit alone: experiments DON'T exist for this scenario (they exist for June2025-MF-train) ❌
    # Therefore: only merit KDMA should be deletable (disabled=False, leaving affiliation alone)
    all_delete_buttons = updated_delete_buttons.all()
    assert len(all_delete_buttons) == 2, (
        f"Should have exactly 2 delete buttons for 2 KDMAs, got {len(all_delete_buttons)}"
    )

    disabled_states = [btn.is_disabled() for btn in all_delete_buttons]
    print(f"Delete buttons disabled states: {disabled_states}")

    # Expected behavior: exactly one delete button enabled, one disabled
    # The merit KDMA should be deletable (disabled=False, leaving affiliation alone)
    # The affiliation KDMA should NOT be deletable (disabled=True, merit alone doesn't exist for this scenario)
    enabled_count = sum(1 for disabled in disabled_states if not disabled)
    disabled_count = sum(1 for disabled in disabled_states if disabled)

    assert enabled_count == 1, (
        f"Expected exactly 1 enabled delete button for June2025-AF-train scenario, but got {enabled_count} enabled buttons: {disabled_states}"
    )
    assert disabled_count == 1, (
        f"Expected exactly 1 disabled delete button for June2025-AF-train scenario, but got {disabled_count} disabled buttons: {disabled_states}"
    )

    print("✓ Correctly identified asymmetric KDMA deletion: one deletable, one not")


def test_kdma_add_remove_updates_experiment_results(page, real_data_test_server):
    """Test that adding/removing KDMAs actually updates the displayed experiment results."""
    page.goto(real_data_test_server)

    # Wait for table to load
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_function(
        "document.querySelectorAll('.table-adm-select').length > 0", timeout=10000
    )

    # Select pipeline_baseline ADM with Mistral LLM to enable multi-KDMA functionality
    ensure_select_value(page, ".table-adm-select", "pipeline_baseline")

    # Select the Mistral LLM to get multi-KDMA experiments
    ensure_select_value(page, ".table-llm-select", "mistralai/Mistral-7B-Instruct-v0.3")

    # Select June2025-AF-train scenario to get multi-KDMA support
    scenario_select = page.locator(".table-scenario-select").first
    scenario_options = scenario_select.locator("option").all()
    scenario_values = [
        opt.get_attribute("value")
        for opt in scenario_options
        if opt.get_attribute("value")
    ]

    # Find June2025-AF-train-0 scenario (required for multi-KDMA test)
    target_scenario = "June2025-AF-train-0"
    june_scenarios = [s for s in scenario_values if target_scenario in s]
    if not june_scenarios:
        # Fallback to any June2025-AF-train scenario
        june_scenarios = [s for s in scenario_values if "June2025-AF-train" in s]

    assert len(june_scenarios) > 0, (
        f"June2025-AF-train scenarios required for this test, but only found: {scenario_values}"
    )

    ensure_select_value(page, ".table-scenario-select", june_scenarios[0])

    # Wait for initial results to load
    wait_for_run_results_loaded(page)
    initial_results = get_experiment_data(page)
    print(f"Initial experiment data: {initial_results}")

    # Debug: Check current KDMA values
    kdma_sliders = page.locator(".table-kdma-value-slider")
    print(f"Number of KDMA sliders: {kdma_sliders.count()}")
    for i in range(kdma_sliders.count()):
        slider = kdma_sliders.nth(i)
        value = slider.input_value()
        kdma_type = slider.get_attribute("data-kdma-type")
        print(f"KDMA {kdma_type}: {value}")

    # Ensure we have some initial content
    assert initial_results, "Should have initial experiment results"

    # Set the initial KDMA slider to a valid value (0 or 1) to enable Add KDMA button
    initial_kdma_slider = page.locator(".table-kdma-value-slider").first
    current_kdma_value = initial_kdma_slider.input_value()
    print(f"Current KDMA value: {current_kdma_value}")

    # Only change if not already a valid value (0 or 1)
    if current_kdma_value not in ["0", "1", "0.0", "1.0"]:
        with wait_for_new_experiment_result(page):
            initial_kdma_slider.evaluate("slider => slider.value = '1'")
            initial_kdma_slider.dispatch_event("input")
        print("Set KDMA slider to 1 to enable Add KDMA button")

    # Add a second KDMA - specifically merit to get affiliation + merit combination
    add_kdma_button = page.locator(".add-kdma-btn")
    assert add_kdma_button.count() > 0, (
        "Add KDMA button must be available for this test"
    )

    # Ensure the button is enabled before clicking
    expect(add_kdma_button).to_be_enabled()

    # Use context manager to wait for experiment data to change when adding KDMA
    with wait_for_new_experiment_result(page):
        add_kdma_button.click()

    # Wait for new KDMA slider to be added
    page.wait_for_function(
        "document.querySelectorAll('.table-kdma-value-slider').length > 1", timeout=5000
    )

    # # Check if there's a KDMA type dropdown for the new KDMA and select merit
    # kdma_type_selects = page.locator(".table-kdma-type-select")
    # if kdma_type_selects.count() > 1:
    #     # Select merit for the second KDMA to ensure we get affiliation + merit combination
    #     with wait_for_new_experiment_result(page):
    #         second_kdma_select = kdma_type_selects.nth(1)
    #         second_kdma_select.select_option("merit")
    #     page.wait_for_load_state("networkidle")

    # Wait for results to reload (the reloadPinnedRun call should update results)
    wait_for_run_results_loaded(page)

    # Debug: Check KDMA values after adding
    kdma_sliders_after = page.locator(".table-kdma-value-slider")
    print(f"Number of KDMA sliders after adding: {kdma_sliders_after.count()}")
    for i in range(kdma_sliders_after.count()):
        slider = kdma_sliders_after.nth(i)
        value = slider.input_value()
        kdma_type = slider.get_attribute("data-kdma-type")
        print(f"KDMA {kdma_type}: {value}")

    # Get results after adding KDMA
    multi_kdma_results = get_experiment_data(page)
    print(f"Results after adding KDMA: {multi_kdma_results}")

    # Results should be different after adding KDMA (different experiment data)
    assert multi_kdma_results != initial_results, (
        f"Experiment results should change after adding KDMA. "
        f"Initial: '{initial_results}' vs Multi-KDMA: '{multi_kdma_results}'"
    )

    # Now remove a KDMA (find an enabled delete button)
    delete_buttons = page.locator(".table-kdma-remove-btn")
    assert delete_buttons.count() >= 2, "Should have delete buttons for multiple KDMAs"

    # Find an enabled delete button
    enabled_button = None
    for i in range(delete_buttons.count()):
        btn = delete_buttons.nth(i)
        if not btn.is_disabled():
            enabled_button = btn
            break

    assert enabled_button is not None, "Should have at least one enabled delete button"

    # Click the enabled delete button
    with wait_for_new_experiment_result(page):
        enabled_button.click()

    # Wait for KDMA to be removed
    page.wait_for_function(
        "document.querySelectorAll('.table-kdma-value-slider').length === 1",
        timeout=5000,
    )

    # Wait for results to reload after removal
    wait_for_run_results_loaded(page)

    # Get results after removing KDMA
    final_results = get_experiment_data(page)
    print(f"Results after removing KDMA: {final_results}")

    # Results should be different from multi-KDMA results
    assert final_results != multi_kdma_results, (
        f"Experiment results should change after removing KDMA. "
        f"Multi-KDMA: '{multi_kdma_results}' vs Final: '{final_results}'"
    )

    # Final results might be same as initial (if we're back to single KDMA)
    # but they could also be different if the remaining KDMA is different
    print("✓ Experiment results correctly updated when adding/removing KDMAs")


def test_add_kdma_button_always_visible(page, real_data_test_server):
    """Test that Add KDMA button is always visible but gets disabled when no more KDMAs can be added."""
    page.goto(real_data_test_server)

    # Wait for table to load
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_function(
        "document.querySelectorAll('.table-adm-select').length > 0", timeout=10000
    )

    # Select pipeline_baseline ADM to enable KDMA functionality
    adm_select = page.locator(".table-adm-select").first
    adm_select.select_option("pipeline_baseline")
    page.wait_for_load_state("networkidle")

    # Select June2025-AF-train scenario to get multi-KDMA support
    scenario_select = page.locator(".table-scenario-select").first
    scenario_options = scenario_select.locator("option").all()
    scenario_values = [
        opt.get_attribute("value")
        for opt in scenario_options
        if opt.get_attribute("value")
    ]

    # Find a June2025-AF-train scenario (required for this test)
    june_scenarios = [s for s in scenario_values if "June2025-AF-train" in s]
    assert len(june_scenarios) > 0, (
        f"June2025-AF-train scenarios required for this test, but only found: {scenario_values}"
    )

    # Only select scenario if it's not already selected
    current_scenario = scenario_select.input_value()
    if current_scenario != june_scenarios[0]:
        with wait_for_new_experiment_result(page):
            scenario_select.select_option(june_scenarios[0])
    else:
        # Scenario already selected, just ensure results are loaded
        page.wait_for_load_state("networkidle")

    # Set initial KDMA slider to a valid value to enable adding another KDMA
    initial_kdma_slider = page.locator(".table-kdma-value-slider").first

    # Ensure slider is set to 1, only change if it's not already 1
    current_value = initial_kdma_slider.input_value()
    if current_value != "1":
        with wait_for_new_experiment_result(page):
            initial_kdma_slider.evaluate("slider => slider.value = '1'")
            initial_kdma_slider.dispatch_event("input")

    page.wait_for_load_state("networkidle")
    wait_for_run_results_loaded(page)

    # Check that Add KDMA button is visible and enabled initially
    add_kdma_button = page.locator(".add-kdma-btn")
    assert add_kdma_button.count() > 0, "Add KDMA button should always be visible"

    # Wait for the button to be enabled
    expect(add_kdma_button).to_be_enabled()

    initial_disabled = add_kdma_button.is_disabled()
    print(f"Initial Add KDMA button disabled: {initial_disabled}")

    # For June2025-AF-train with pipeline_baseline, we should be able to add KDMAs initially
    assert not initial_disabled, "Add KDMA button should be enabled initially"

    # Add a KDMA
    with wait_for_new_experiment_result(page):
        add_kdma_button.click()

    # Wait for KDMA to be added
    page.wait_for_function(
        "document.querySelectorAll('.table-kdma-value-slider').length > 1", timeout=5000
    )

    # Check that Add KDMA button is still visible
    updated_add_button = page.locator(".add-kdma-btn")
    assert updated_add_button.count() > 0, (
        "Add KDMA button should still be visible after adding KDMA"
    )

    # Check if it's disabled (depends on how many KDMA types are available)
    after_add_disabled = updated_add_button.is_disabled()
    print(f"Add KDMA button disabled after adding one: {after_add_disabled}")

    # The button should now be disabled since we've likely reached the limit for this scenario
    # (pipeline_baseline typically supports only affiliation+merit combination)
    assert after_add_disabled, (
        "Add KDMA button should be disabled when no more KDMA types can be added"
    )

    # Verify tooltip is present when disabled
    tooltip = updated_add_button.get_attribute("title")
    assert tooltip, (
        "Disabled Add KDMA button should have a tooltip explaining why it's disabled"
    )
    print(f"Disabled button tooltip: {tooltip}")

    # Tooltip should explain why it's disabled
    assert (
        "available" in tooltip.lower()
        or "maximum" in tooltip.lower()
        or "reached" in tooltip.lower()
    ), f"Tooltip should explain why button is disabled, got: {tooltip}"

    print(
        "✓ Add KDMA button correctly stays visible and shows appropriate enabled/disabled state"
    )


def test_run_variant_dropdown_functionality(page, real_data_test_server):
    """Test that run_variant dropdown shows available variants when multiple runs exist."""
    page.goto(real_data_test_server)

    # Wait for page to load and auto-pin to happen
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_function(
        "document.querySelectorAll('.table-adm-select').length > 0", timeout=10000
    )

    # Wait for initial auto-pin to complete
    page.wait_for_function(
        "document.querySelectorAll('.comparison-table tr').length > 2", timeout=5000
    )

    # Look for run variant row
    run_variant_row = page.locator(".parameter-row[data-parameter='run_variant']")
    expect(run_variant_row).to_be_visible()

    # Check if run variant dropdown exists
    run_variant_dropdown = page.locator(".table-run-variant-select")

    # If dropdown exists, verify it has options
    if run_variant_dropdown.count() > 0:
        options = run_variant_dropdown.locator("option").all()
        option_values = [
            opt.get_attribute("value") for opt in options if opt.get_attribute("value")
        ]

        # Should have at least one option
        assert len(option_values) > 0, "Run variant dropdown should have options"

        # Test that selecting different variants works
        if len(option_values) > 1:
            # Get initial selected value
            _ = run_variant_dropdown.first.input_value()

            # Select first option and verify it's selected
            run_variant_dropdown.first.select_option(option_values[0])
            page.wait_for_load_state("networkidle")

            # Wait for dropdown to stabilize after selection
            page.wait_for_timeout(500)

            # Check if dropdown still exists after first selection
            if run_variant_dropdown.count() > 0:
                first_selection = run_variant_dropdown.first.input_value()
                assert first_selection == option_values[0], (
                    f"First option should be selected, got {first_selection}"
                )
            else:
                print("Dropdown disappeared after first selection")

            # Select second option and verify it's selected
            run_variant_dropdown.first.select_option(option_values[1])
            page.wait_for_load_state("networkidle")

            # Wait for dropdown value to be applied
            page.wait_for_function(
                f"document.querySelector('.table-run-variant-select').value === '{option_values[1]}'",
                timeout=2000,
            )

            # Check that dropdown still exists after second selection
            updated_dropdown = page.locator(".table-run-variant-select")
            assert updated_dropdown.count() > 0, (
                "Dropdown should still exist after selecting second option"
            )

            # Verify second option is selected and persists
            second_selection = updated_dropdown.first.input_value()
            assert second_selection == option_values[1], (
                f"Second option should be selected and persist, got {second_selection}"
            )

            # Check that the run variant cell doesn't show "N/A"
            run_variant_cell = page.locator(
                ".parameter-row[data-parameter='run_variant'] td"
            ).nth(1)
            cell_text = run_variant_cell.text_content()
            assert "N/A" not in cell_text, (
                f"Run variant cell should not show N/A, got: {cell_text}"
            )

            # Wait to ensure selection persists (test for reversion)
            page.wait_for_function(
                f"document.querySelector('.table-run-variant-select').value === '{option_values[1]}'",
                timeout=2000,
            )
            final_selection = updated_dropdown.first.input_value()
            assert final_selection == option_values[1], (
                f"Selection should persist, but reverted to {final_selection}"
            )

        print(f"Run variant dropdown has options: {option_values}")
    else:
        # If no dropdown, should show a static value
        run_variant_cell = page.locator(
            ".parameter-row[data-parameter='run_variant'] td"
        ).nth(1)
        cell_text = run_variant_cell.text_content()
        print(f"Run variant shows static value: {cell_text}")

        # Should not be empty
        assert cell_text and cell_text.strip() != "", (
            "Run variant should show some value"
        )
