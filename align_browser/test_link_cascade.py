"""Test that linked parameter cascading works properly"""
from playwright.sync_api import Page


def test_linked_scenario_scene_cascade(page: Page, real_data_test_server: str):
    """Test that when scenario and scene are linked, changing scenario cascades scene properly."""
    page.goto(real_data_test_server)
    
    # Wait for page to load
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_function(
        "document.querySelectorAll('.table-scenario-select').length > 0", timeout=10000
    )
    
    # Add a second column for testing
    add_column_btn = page.locator("#add-column-btn")
    if add_column_btn.is_visible():
        add_column_btn.click()
        page.wait_for_timeout(1000)
    
    # Get initial scenario values from both columns
    scenario_selects = page.locator(".table-scenario-select")
    assert scenario_selects.count() >= 2, "Need at least 2 columns to test"
    
    initial_scenario_col1 = scenario_selects.nth(0).input_value()
    initial_scenario_col2 = scenario_selects.nth(1).input_value()
    
    # Get initial scene values - scene dropdowns use table-scenario-select class but in scene row
    scene_row = page.locator("tr.parameter-row[data-parameter='scene']")
    scene_selects = scene_row.locator(".table-scenario-select")
    initial_scene_col1 = scene_selects.nth(0).input_value()
    initial_scene_col2 = scene_selects.nth(1).input_value()
    
    print("Initial states:")
    print(f"  Column 1: scenario={initial_scenario_col1}, scene={initial_scene_col1}")
    print(f"  Column 2: scenario={initial_scenario_col2}, scene={initial_scene_col2}")
    
    # Link both scenario and scene parameters
    scenario_row = page.locator("tr.parameter-row[data-parameter='scenario']")
    scenario_link = scenario_row.locator(".link-icon")
    scenario_link.click()
    page.wait_for_timeout(500)
    
    scene_row = page.locator("tr.parameter-row[data-parameter='scene']")  
    scene_link = scene_row.locator(".link-icon")
    scene_link.click()
    page.wait_for_timeout(500)
    
    # Verify both are linked - the row itself gets the linked class
    assert "linked" in scenario_row.get_attribute("class"), "Scenario row should have 'linked' class"
    assert "linked" in scene_row.get_attribute("class"), "Scene row should have 'linked' class"
    
    # Change scenario in first column to a different value
    # Find a different scenario option
    scenario_select_col1 = scenario_selects.nth(0)
    options = scenario_select_col1.locator("option").all()
    new_scenario = None
    for option in options:
        value = option.get_attribute("value")
        if value and value != initial_scenario_col1:
            new_scenario = value
            break
    
    assert new_scenario is not None, "Could not find a different scenario to switch to"
    
    print(f"\nChanging scenario from {initial_scenario_col1} to {new_scenario}")
    scenario_select_col1.select_option(new_scenario)
    page.wait_for_timeout(2000)  # Wait for cascading and data reload
    
    # Check the results after changing scenario
    final_scenario_col1 = scenario_selects.nth(0).input_value()
    final_scenario_col2 = scenario_selects.nth(1).input_value()
    final_scene_col1 = scene_selects.nth(0).input_value()
    final_scene_col2 = scene_selects.nth(1).input_value()
    
    print("\nFinal states:")
    print(f"  Column 1: scenario={final_scenario_col1}, scene={final_scene_col1}")
    print(f"  Column 2: scenario={final_scenario_col2}, scene={final_scene_col2}")
    
    # Verify scenarios are synced (both should have the new scenario)
    assert final_scenario_col1 == new_scenario, "Column 1 should have the new scenario"
    assert final_scenario_col2 == new_scenario, "Column 2 should also have the new scenario (linked)"
    
    # Verify scenes are synced AND valid for the new scenario
    assert final_scene_col1 == final_scene_col2, "Scenes should be synced across columns"
    
    # Check that we don't have "No data available" messages
    no_data_messages = page.locator(".no-data-message").all()
    for msg in no_data_messages:
        if msg.is_visible():
            parent_cell = msg.locator("..").first
            print(f"WARNING: Found 'No data available' message in cell: {parent_cell.inner_text()}")
    
    # The key test: scenes should have cascaded to valid values, not preserved invalid ones
    assert len([msg for msg in no_data_messages if msg.is_visible()]) == 0, \
        "Should not have any 'No data available' messages after linked cascade"
    
    print("\nTest passed! Linked parameters cascade properly.")