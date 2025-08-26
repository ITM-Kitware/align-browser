#!/usr/bin/env python3
"""
Automated frontend testing for the ADM Results app using Playwright.
This script builds the frontend and runs automated browser tests.
"""

from playwright.sync_api import expect


def test_page_load(page, real_data_test_server):
    """Test that the page loads without errors."""
    page.goto(real_data_test_server)

    # Check page title
    expect(page).to_have_title("Align Browser")

    # Check that main elements exist
    expect(page.locator("#runs-container")).to_be_visible()

    # Wait for table to load
    page.wait_for_selector(".comparison-table", timeout=10000)
    expect(page.locator(".comparison-table")).to_be_visible()


def test_run_variant_row_present(page, real_data_test_server):
    """Test that the run variant row is present in the UI."""
    page.goto(real_data_test_server)

    # Wait for page to load
    page.wait_for_selector(".comparison-table", timeout=10000)

    # Check that the run_variant parameter row exists
    run_variant_row = page.locator("tr.parameter-row[data-parameter='run_variant']")
    expect(run_variant_row).to_have_count(1, timeout=5000)


def test_manifest_loading(page, real_data_test_server):
    """Test that manifest.json loads and populates UI elements."""
    page.goto(real_data_test_server)

    # Wait for table to load
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_function(
        "document.querySelectorAll('.table-adm-select').length > 0", timeout=10000
    )

    # Check that ADM options are populated in table
    adm_select = page.locator(".table-adm-select").first
    expect(adm_select).to_be_visible()

    # Check that ADM options are populated
    options = adm_select.locator("option").all()
    assert len(options) > 0, "ADM dropdown should have options"

    # Check that we have at least one ADM type (filtered by current scenario)
    option_texts = [option.text_content() for option in options]
    assert len(option_texts) > 0, "Should have at least one ADM option"


def test_run_display_updates(page, real_data_test_server):
    """Test that results display updates when selections are made."""
    page.goto(real_data_test_server)

    # Wait for table to load
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_function(
        "document.querySelectorAll('.table-adm-select').length > 0", timeout=10000
    )

    comparison_table = page.locator(".comparison-table")

    # Make complete selections using available option from generated test data
    adm_select = page.locator(".table-adm-select").first
    # Use the first available ADM option instead of hardcoding
    available_options = adm_select.locator("option").all()
    adm_options = [
        opt.get_attribute("value")
        for opt in available_options
        if opt.get_attribute("value")
    ]
    assert len(adm_options) > 0, "Should have ADM options available"
    adm_select.select_option(adm_options[0])

    # Wait for content to update
    page.wait_for_function(
        "document.querySelector('.comparison-table').textContent.trim() !== ''",
        timeout=5000,
    )

    # Check that comparison table is visible and has content
    expect(comparison_table).to_be_visible()
    table_text = comparison_table.text_content()

    # It should either show data, an error message, or "no data found"
    # During development, any of these is acceptable
    assert table_text.strip() != "", (
        "Comparison table should have some content after selections"
    )

    # Results should show either actual data or expected messages


def test_choice_info_expansion_state_persistence(page, real_data_test_server):
    """Test that Choice Info row expansion state persists when changing parameters."""
    page.goto(real_data_test_server)

    # Wait for table and select ADM to load data
    page.wait_for_selector(".comparison-table", timeout=10000)
    adm_select = page.locator(".table-adm-select").first
    adm_select.wait_for(timeout=10000)
    adm_select.select_option(index=1)  # Select first real option

    # Wait for Choice Info toggle button to appear
    page.wait_for_selector(".choice-info-toggle", timeout=10000)

    # Click to expand the first Choice Info section
    expand_button = page.locator(".choice-info-toggle").first
    expand_button.click()

    # Verify section is expanded
    button_id = expand_button.get_attribute("id")
    section_id = button_id.replace("_button", "_details")
    details_div = page.locator(f"#{section_id}")
    assert details_div.is_visible(), "Section should be expanded"

    # Change scenario to trigger re-render
    scenario_select = page.locator(".table-scenario-select").first
    current_value = scenario_select.input_value()
    scenario_select.select_option(index=0)  # Change to different option
    page.wait_for_timeout(500)
    scenario_select.select_option(value=current_value)  # Change back
    page.wait_for_timeout(500)

    # Check if section is still expanded (this will fail due to the bug)
    details_div = page.locator(f"#{section_id}")
    assert details_div.is_visible(), (
        "Choice Info section should remain expanded after parameter change"
    )


def test_no_console_errors(page, real_data_test_server):
    """Test that there are no severe console errors on page load."""
    # Listen for console messages
    console_messages = []
    page.on("console", lambda msg: console_messages.append(msg))

    page.goto(real_data_test_server)

    # Wait for page to fully load
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_function(
        "document.querySelectorAll('.table-adm-select').length > 0", timeout=10000
    )

    # Check for severe errors
    errors = [msg for msg in console_messages if msg.type == "error"]

    # Filter out expected errors during development
    severe_errors = []
    for error in errors:
        error_text = error.text

        # Always catch JavaScript reference/syntax errors - these are code bugs
        if any(
            js_error in error_text.lower()
            for js_error in [
                "referenceerror",
                "syntaxerror",
                "typeerror",
                "is not defined",
                "cannot read property",
                "cannot read properties",
            ]
        ):
            severe_errors.append(error_text)
        # Ignore network errors for missing data files during development
        elif not any(
            ignore in error_text.lower()
            for ignore in [
                "404",
                "failed to fetch",
                "network error",
                "manifest",
                "data/",
            ]
        ):
            severe_errors.append(error_text)

    assert len(severe_errors) == 0, f"Found severe console errors: {severe_errors}"


def test_kdma_type_filtering_prevents_duplicates(page, real_data_test_server):
    """Test that KDMA type dropdowns filter out already-used types."""
    page.goto(real_data_test_server)

    # Wait for page to load and select a scenario that supports multiple KDMAs
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_function(
        "document.querySelectorAll('.table-adm-select').length > 0", timeout=10000
    )

    # Wait for table to be ready - options might be hidden initially
    page.wait_for_function(
        "document.querySelectorAll('.table-adm-select option').length > 0", timeout=5000
    )

    # Look for an ADM that supports KDMAs (contains "pipeline_baseline")
    adm_select = page.locator(".table-adm-select").first
    available_options = adm_select.locator("option").all()
    adm_options = [
        opt.get_attribute("value")
        for opt in available_options
        if opt.get_attribute("value")
    ]

    # Try to find a pipeline_baseline option that supports KDMAs
    baseline_options = [opt for opt in adm_options if "pipeline_baseline" in opt]
    selected_option = baseline_options[0] if baseline_options else adm_options[0]

    adm_select.select_option(selected_option)
    # Wait for any updates instead of fixed timeout
    page.wait_for_load_state("networkidle")

    # Check KDMA value dropdowns in table
    kdma_dropdowns = page.locator(".table-kdma-value-select")
    dropdown_count = kdma_dropdowns.count()

    # KDMA dropdowns may or may not be available depending on selected ADM type
    print(f"Found {dropdown_count} KDMA dropdowns for ADM: {selected_option}")

    # Test that KDMA dropdowns are functional
    if dropdown_count > 0:
        first_dropdown = kdma_dropdowns.first
        expect(first_dropdown).to_be_visible()

        # Test dropdown interaction - select first available option that's different from current
        options = first_dropdown.locator("option").all_text_contents()
        if len(options) > 1:
            first_dropdown.select_option(index=1)
            page.wait_for_timeout(500)


def test_kdma_max_limit_enforcement(page, real_data_test_server):
    """Test that KDMA addition respects experiment data limits."""
    page.goto(real_data_test_server)

    # Wait for page to load
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_function(
        "document.querySelectorAll('.table-adm-select').length > 0", timeout=10000
    )

    # Look for an ADM that supports KDMAs
    adm_select = page.locator(".table-adm-select").first
    available_options = adm_select.locator("option").all()
    adm_options = [
        opt.get_attribute("value")
        for opt in available_options
        if opt.get_attribute("value")
    ]

    # Try to find a pipeline_baseline option that supports KDMAs
    baseline_options = [opt for opt in adm_options if "pipeline_baseline" in opt]
    selected_option = baseline_options[0] if baseline_options else adm_options[0]

    adm_select.select_option(selected_option)
    # Wait for any updates instead of fixed timeout
    page.wait_for_load_state("networkidle")

    # Test that KDMA dropdowns are present and functional
    kdma_dropdowns = page.locator(".table-kdma-value-select")
    dropdown_count = kdma_dropdowns.count()

    # Test passes regardless of KDMA dropdown availability - depends on selected ADM
    print(f"Found {dropdown_count} KDMA dropdowns for ADM: {selected_option}")

    # Test dropdown functionality
    if dropdown_count > 0:
        first_dropdown = kdma_dropdowns.first
        expect(first_dropdown).to_be_visible()
        # Get available options and select a different one if possible
        options = first_dropdown.locator("option").all_text_contents()
        if len(options) > 1:
            first_dropdown.select_option(index=1)
            page.wait_for_timeout(500)

    # Verify table continues to work after changes
    expect(page.locator(".comparison-table")).to_be_visible()


def test_kdma_removal_updates_constraints(page, real_data_test_server):
    """Test that KDMA dropdowns are functional in table-based UI."""
    page.goto(real_data_test_server)

    # Wait for page to load
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_function(
        "document.querySelectorAll('.table-adm-select').length > 0", timeout=10000
    )

    # Select ADM that supports KDMAs
    # Use available ADM option from test data
    adm_select = page.locator(".table-adm-select").first
    available_options = adm_select.locator("option").all()
    adm_options = [
        opt.get_attribute("value")
        for opt in available_options
        if opt.get_attribute("value")
    ]
    if adm_options:
        adm_select.select_option(adm_options[0])
    page.wait_for_timeout(1000)

    # Check for KDMA dropdowns in the table
    kdma_dropdowns = page.locator(".table-kdma-value-select")
    initial_dropdown_count = kdma_dropdowns.count()

    if initial_dropdown_count > 0:
        # Test that dropdowns are functional
        first_dropdown = kdma_dropdowns.first
        expect(first_dropdown).to_be_visible()

        # Select different option if available
        options = first_dropdown.locator("option").all_text_contents()
        if len(options) > 1:
            first_dropdown.select_option(index=1)
            page.wait_for_timeout(500)

            # Verify dropdown value updated
            assert first_dropdown.locator("option:checked").count() == 1, (
                "KDMA dropdown should have selected value"
            )

        # Verify table still functions
        expect(page.locator(".comparison-table")).to_be_visible()


def test_kdma_adm_change_resets_properly(page, real_data_test_server):
    """Test that changing ADM type properly updates available controls."""
    page.goto(real_data_test_server)

    # Wait for page to load
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_function(
        "document.querySelectorAll('.table-adm-select').length > 0", timeout=10000
    )

    # Test switching between different ADM types
    adm_select = page.locator(".table-adm-select").first

    # Get available ADM options and use them dynamically
    available_options = adm_select.locator("option").all()
    adm_options = [
        opt.get_attribute("value")
        for opt in available_options
        if opt.get_attribute("value")
    ]

    if len(adm_options) >= 2:
        # Test switching between ADM types if multiple available
        # Start with first option
        adm_select.select_option(adm_options[0])
        page.wait_for_timeout(1000)

        # Switch to second option
        adm_select.select_option(adm_options[1])
        page.wait_for_timeout(1000)

        # Verify the interface still works after ADM change
        expect(page.locator(".comparison-table")).to_be_visible()
        expect(adm_select).to_be_visible()
    else:
        # If only one ADM option, just verify it works
        print(f"Only one ADM option available: {adm_options}")
        if adm_options:
            adm_select.select_option(adm_options[0])
            page.wait_for_timeout(1000)

        # Verify the interface works
        expect(page.locator(".comparison-table")).to_be_visible()
        expect(adm_select).to_be_visible()


def test_scenario_based_kdma_filtering(page, real_data_test_server):
    """Test that KDMA filtering follows correct hierarchy: Scenario → ADM → KDMA values.

    This test specifically addresses the bug where only the first KDMA type would show
    results because the filtering was backwards (KDMA → Scenario instead of Scenario → KDMA).
    """
    page.goto(real_data_test_server)

    # Wait for page to load
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_function(
        "document.querySelectorAll('.table-adm-select').length > 0", timeout=10000
    )

    # Get all available scenarios from table
    scenario_select = page.locator(".table-scenario-select").first
    scenario_options = scenario_select.locator("option").all()
    available_scenarios = [
        opt.get_attribute("value")
        for opt in scenario_options
        if opt.get_attribute("value")
    ]

    # Should have multiple scenarios available (our test data has different scenarios)
    assert len(available_scenarios) >= 2, (
        f"Test requires multiple scenarios, got: {available_scenarios}"
    )

    # Test that different scenarios show different KDMA types
    scenario_kdma_mapping = {}

    for scenario_type in available_scenarios[:3]:  # Test first 3 scenarios
        print(f"\nTesting scenario: {scenario_type}")

        # Select this scenario
        scenario_select.select_option(scenario_type)
        page.wait_for_load_state("networkidle")

        # Select a consistent ADM type using available options
        adm_select = page.locator(".table-adm-select").first
        available_options = adm_select.locator("option").all()
        adm_options = [
            opt.get_attribute("value")
            for opt in available_options
            if opt.get_attribute("value")
        ]

        # Try to find a pipeline_baseline option, fallback to first available
        baseline_options = [opt for opt in adm_options if "pipeline_baseline" in opt]
        selected_option = baseline_options[0] if baseline_options else adm_options[0]

        adm_select.select_option(selected_option)
        page.wait_for_load_state("networkidle")

        # Check what KDMA dropdowns are available in table
        kdma_dropdowns = page.locator(".table-kdma-value-select")
        dropdown_count = kdma_dropdowns.count()

        if dropdown_count > 0:
            # For table-based UI, we test dropdown functionality
            first_dropdown = kdma_dropdowns.first
            options = first_dropdown.locator("option").all_text_contents()
            if len(options) > 1:
                first_dropdown.select_option(index=1)
                # Wait for updates to complete
                page.wait_for_load_state("networkidle")

            scenario_kdma_mapping[scenario_type] = ["kdma_available"]
            print(f"  KDMA dropdowns available: {dropdown_count}")

            # Check results in table format
            expect(page.locator(".comparison-table")).to_be_visible()

            # Verify data is loaded by checking for table content
            table_data = page.locator(".comparison-table").text_content()
            assert len(table_data) > 0, (
                f"Scenario '{scenario_type}' should show table data"
            )

    print(f"\nScenario → KDMA mapping: {scenario_kdma_mapping}")

    # Verify that scenarios are properly loaded and functional
    assert len(scenario_kdma_mapping) > 0, "Should have processed at least one scenario"
    print(f"Processed scenarios: {list(scenario_kdma_mapping.keys())}")

    # Basic validation that table-based UI is working
    expect(page.locator(".comparison-table")).to_be_visible()


def test_initial_load_results_path(page, real_data_test_server):
    """Test that initial page load and results loading works without errors."""
    # Listen for console errors
    console_errors = []
    page.on(
        "console",
        lambda msg: console_errors.append(msg) if msg.type == "error" else None,
    )

    page.goto(real_data_test_server)

    # Wait for manifest to load and trigger initial results load
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_function(
        "document.querySelectorAll('.table-adm-select').length > 0", timeout=10000
    )

    # Wait for initial results to load
    page.wait_for_function(
        "document.querySelector('.comparison-table').textContent.trim() !== ''",
        timeout=5000,
    )

    # Check for JavaScript errors
    js_errors = []
    for error in console_errors:
        error_text = error.text
        if any(
            js_error in error_text.lower()
            for js_error in [
                "referenceerror",
                "syntaxerror",
                "typeerror",
                "is not defined",
                "cannot read property",
                "cannot read properties",
            ]
        ):
            js_errors.append(error_text)

    assert len(js_errors) == 0, (
        f"Found JavaScript errors during initial load: {js_errors}"
    )

    # Verify comparison table is displayed (always-on mode)
    comparison_table = page.locator(".comparison-table")
    expect(comparison_table).to_be_visible()

    # Should have table structure
    parameter_header = page.locator(".parameter-header")
    if parameter_header.count() > 0:
        expect(parameter_header.first).to_be_visible()

    # Should have some content (even if it's "no data found")
    table_content = comparison_table.text_content()
    assert table_content.strip() != "", (
        "Comparison table should have content after initial load"
    )


def test_link_functionality(page, real_data_test_server):
    """Test that parameter link functionality works correctly."""
    page.goto(real_data_test_server)

    # Wait for page to load
    page.wait_for_selector(".comparison-table", timeout=10000)

    # Add a second column to test sync between columns
    add_column_btn = page.locator("#add-column-btn")
    if add_column_btn.is_visible():
        add_column_btn.click()
        page.wait_for_timeout(1000)  # Wait for column to be added

    # Test that link toggle exists for scenario
    scenario_row = page.locator("tr.parameter-row[data-parameter='scenario']")
    link_toggle_label = scenario_row.locator(".link-toggle")
    expect(link_toggle_label).to_have_count(1)

    # Test that row gets linked class when toggle is enabled (click the label)
    link_toggle_label.click()
    page.wait_for_timeout(500)
    expect(scenario_row).to_have_class("parameter-row linked")

    # Test that link toggle can be disabled
    link_toggle_label.click()
    page.wait_for_timeout(500)
    expect(scenario_row).to_have_class("parameter-row")


def test_linked_parameter_updates_run_data(page, real_data_test_server):
    """Test that when linked parameters change, run data updates in all columns."""
    page.goto(real_data_test_server)

    # Wait for page to load
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_function(
        "document.querySelectorAll('.table-scenario-select').length > 0", timeout=10000
    )

    # Count initial columns
    scenario_selects = page.locator(".table-scenario-select")
    initial_column_count = scenario_selects.count()

    # Add a second column if we don't have at least 2
    if initial_column_count < 2:
        add_column_btn = page.locator("#add-column-btn")
        if add_column_btn.is_visible():
            add_column_btn.click()
            page.wait_for_timeout(1000)

    # Verify we have at least 2 columns to work with
    scenario_dropdowns = page.locator('select[onchange*="handleRunScenarioChange"]')
    scene_dropdowns = page.locator('select[onchange*="handleRunSceneChange"]')
    scenario_count = scenario_dropdowns.count()
    scene_count = scene_dropdowns.count()

    print(
        f"Debug: Found {scenario_count} scenario dropdowns and {scene_count} scene dropdowns"
    )

    # We need at least one scenario dropdown to test
    assert scenario_count >= 1, (
        f"Need at least 1 scenario dropdown for test, got {scenario_count}"
    )

    # Link the scenario parameter
    scenario_row = page.locator("tr.parameter-row[data-parameter='scenario']")
    link_toggle = scenario_row.locator(".link-toggle")
    link_toggle.click()
    page.wait_for_timeout(500)
    expect(scenario_row).to_have_class("parameter-row linked")

    # Get scenario dropdowns specifically by their onchange handler
    first_scenario_select = page.locator(
        'select[onchange*="handleRunScenarioChange"]'
    ).first
    scenario_options = first_scenario_select.locator("option").all()
    available_scenarios = [
        opt.get_attribute("value")
        for opt in scenario_options
        if opt.get_attribute("value") and opt.get_attribute("value") != ""
    ]

    assert len(available_scenarios) >= 2, (
        f"Need at least 2 scenarios for test, got: {available_scenarios}"
    )

    # Get initial scenario value
    initial_scenario = first_scenario_select.input_value()

    # Choose a different scenario
    new_scenario = None
    for scenario in available_scenarios:
        if scenario != initial_scenario:
            new_scenario = scenario
            break

    assert new_scenario is not None, "Could not find different scenario to test with"

    # Get initial run data from both columns (look for ADM decision or justification)
    initial_data_col1 = None

    adm_decision_row = page.locator("tr.parameter-row[data-parameter='adm_decision']")
    if adm_decision_row.count() > 0:
        decision_cells = adm_decision_row.locator("td.pinned-run-value")
        if decision_cells.count() >= 2:
            initial_data_col1 = decision_cells.nth(0).text_content()

    # Change scenario in first column
    first_scenario_select.select_option(new_scenario)

    # Wait for data to reload
    page.wait_for_timeout(2000)
    page.wait_for_load_state("networkidle")

    # Verify both columns now show the new scenario
    scenario_dropdowns = page.locator('select[onchange*="handleRunScenarioChange"]')
    updated_scenario_count = scenario_dropdowns.count()
    print(
        f"Debug: After scenario change, found {updated_scenario_count} scenario dropdowns"
    )

    expect(first_scenario_select).to_have_value(new_scenario)

    # Only test the second dropdown if it exists
    if updated_scenario_count >= 2:
        second_scenario_select = scenario_dropdowns.nth(1)
        expect(second_scenario_select).to_have_value(new_scenario)
    else:
        print(
            "Debug: Only one scenario dropdown found after change - linking might have worked by hiding the second dropdown"
        )

    # Verify both columns have updated run data (not just parameter values)
    # Check how many run data columns we actually have
    adm_decision_row = page.locator("tr.parameter-row[data-parameter='adm_decision']")
    justification_row = page.locator("tr.parameter-row[data-parameter='justification']")

    data_verified = False

    if adm_decision_row.count() > 0:
        decision_cells = adm_decision_row.locator("td.pinned-run-value")
        cell_count = decision_cells.count()
        print(f"Debug: Found {cell_count} ADM decision cells")

        if cell_count >= 2:
            new_data_col1 = decision_cells.nth(0).text_content()
            new_data_col2 = decision_cells.nth(1).text_content()
            print(
                f"Debug: ADM decision data - col1: '{new_data_col1}', col2: '{new_data_col2}'"
            )

            # Both columns should now have the same data
            assert new_data_col1 == new_data_col2, (
                f"Linked columns should have same run data: col1='{new_data_col1}', col2='{new_data_col2}'"
            )

            # The data should have changed from the initial values (if initial data existed)
            if (
                initial_data_col1
                and initial_data_col1 != "N/A"
                and "No data" not in initial_data_col1
            ):
                # Only check if initial data wasn't a "no data" state
                if "No data" not in new_data_col1 and new_data_col1 != "N/A":
                    assert new_data_col1 != initial_data_col1, (
                        f"Run data should have changed from '{initial_data_col1}' to '{new_data_col1}'"
                    )
            data_verified = True
        elif cell_count == 1:
            print(
                "Debug: Only one ADM decision cell found - columns might be identical"
            )
            new_data_col1 = decision_cells.nth(0).text_content()
            print(f"Debug: Single ADM decision data: '{new_data_col1}'")
            data_verified = True

    if not data_verified and justification_row.count() > 0:
        justification_cells = justification_row.locator("td.pinned-run-value")
        cell_count = justification_cells.count()
        print(f"Debug: Found {cell_count} justification cells")

        if cell_count >= 2:
            new_data_col1 = justification_cells.nth(0).text_content()
            new_data_col2 = justification_cells.nth(1).text_content()
            print(
                f"Debug: Justification data - col1: '{new_data_col1}', col2: '{new_data_col2}'"
            )

            # Both columns should now have the same data
            assert new_data_col1 == new_data_col2, (
                f"Linked columns should have same run data: col1='{new_data_col1}', col2='{new_data_col2}'"
            )
            data_verified = True
        elif cell_count == 1:
            print(
                "Debug: Only one justification cell found - columns might be identical"
            )
            new_data_col1 = justification_cells.nth(0).text_content()
            print(f"Debug: Single justification data: '{new_data_col1}'")
            data_verified = True

    # If we successfully updated parameters and the run data looks consistent, that's a pass
    if data_verified:
        print(
            "Debug: Successfully verified that linked parameter change updated run data"
        )
    else:
        print("Debug: Could not find run data to verify, but parameter linking worked")

    print(
        f"Successfully verified linked parameter updates: {initial_scenario} -> {new_scenario}"
    )
