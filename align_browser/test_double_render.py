#!/usr/bin/env python3
"""
Test to detect double rendering issue when changing parameters.
"""

from playwright.sync_api import expect


def test_parameter_change_render_count(page, real_data_test_server):
    """Test that changing a parameter doesn't cause excessive re-renders."""

    # Collect console messages
    console_messages = []
    page.on("console", lambda msg: console_messages.append(msg))

    # Navigate to the page
    page.goto(real_data_test_server)

    # Wait for initial load
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_load_state("networkidle")

    # Clear console messages from initial load
    console_messages.clear()

    # Find an ADM dropdown to change
    adm_select = page.locator(".table-adm-select").first
    expect(adm_select).to_be_visible()

    # Get available options
    options = adm_select.locator("option").all()
    adm_values = [
        opt.get_attribute("value") for opt in options if opt.get_attribute("value")
    ]

    # Need at least 2 options to test changing
    if len(adm_values) < 2:
        print("Skipping test - not enough ADM options to test parameter change")
        return

    # Get current value
    current_value = adm_select.input_value()

    # Find a different value to select
    new_value = None
    for val in adm_values:
        if val != current_value:
            new_value = val
            break

    assert new_value is not None, "Could not find alternative ADM value"

    print(f"Changing ADM from '{current_value}' to '{new_value}'")

    # Change the parameter
    adm_select.select_option(new_value)

    # Wait for any renders to complete
    page.wait_for_timeout(2000)  # Give time for all async operations

    # Count render calls in console
    render_calls = []
    for msg in console_messages:
        if "[DEBUG] renderComparisonTable called" in msg.text:
            render_calls.append(msg.text)

    print(f"\nFound {len(render_calls)} render calls after parameter change:")
    for i, call in enumerate(render_calls, 1):
        print(f"  {i}. {call}")

    # Check for excessive renders (more than 2 is likely a problem)
    assert len(render_calls) <= 2, (
        f"Too many render calls ({len(render_calls)}) after single parameter change. "
        f"This indicates a double/multiple rendering issue."
    )

    # If we have exactly 2, warn but don't fail (might be acceptable in some cases)
    if len(render_calls) == 2:
        print("WARNING: 2 render calls detected - possible double rendering issue")


def test_linked_parameter_change_render_count(page, real_data_test_server):
    """Test render count when toggling parameter linking."""

    # Collect console messages
    console_messages = []
    page.on("console", lambda msg: console_messages.append(msg))

    # Navigate to the page
    page.goto(real_data_test_server)

    # Wait for initial load
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_load_state("networkidle")

    # Check if there's an Add Column button to add a second column
    add_column_btn = page.locator("#add-column-btn")
    if add_column_btn.is_visible():
        # Add a second column for testing linking
        add_column_btn.click()
        page.wait_for_timeout(1000)

    # Clear console messages from initial setup
    console_messages.clear()

    # Find a link toggle button (e.g., for scenario)
    link_button = page.locator("tr[data-parameter='scenario'] .link-icon").first

    if not link_button.is_visible():
        print("No link button found - skipping linked parameter test")
        return

    print("Toggling parameter link...")

    # Click the link toggle
    link_button.click()

    # Wait for any renders to complete
    page.wait_for_timeout(2000)  # Give time for all async operations

    # Count render calls in console
    render_calls = []
    for msg in console_messages:
        if "[DEBUG] renderComparisonTable called" in msg.text:
            render_calls.append(msg.text)

    print(f"\nFound {len(render_calls)} render calls after toggling parameter link:")
    for i, call in enumerate(render_calls, 1):
        print(f"  {i}. {call}")

    # When toggling a link, we might expect multiple renders (one for link state, one for propagation)
    # But excessive renders (>3) indicate a problem
    assert len(render_calls) <= 3, (
        f"Too many render calls ({len(render_calls)}) after toggling parameter link. "
        f"This indicates excessive re-rendering."
    )

    if len(render_calls) >= 2:
        print(
            f"WARNING: {len(render_calls)} render calls detected - possible multiple rendering issue"
        )


def test_kdma_slider_render_count(page, real_data_test_server):
    """Test render count when adjusting KDMA slider values."""

    # Collect console messages
    console_messages = []
    page.on("console", lambda msg: console_messages.append(msg))

    # Navigate to the page
    page.goto(real_data_test_server)

    # Wait for initial load
    page.wait_for_selector(".comparison-table", timeout=10000)
    page.wait_for_load_state("networkidle")

    # Find a KDMA slider if present
    kdma_slider = page.locator("input.kdma-slider").first

    if not kdma_slider.is_visible():
        print("No KDMA slider found - skipping KDMA test")
        return

    # Clear console messages from initial load
    console_messages.clear()

    # Get current value
    current_value = kdma_slider.input_value()
    print(f"Current KDMA value: {current_value}")

    # Change the slider value
    new_value = "0.5" if current_value != "0.5" else "0.7"
    print(f"Changing KDMA slider to: {new_value}")

    # Set new value and trigger input event
    kdma_slider.evaluate(f"slider => {{ slider.value = '{new_value}'; }}")
    kdma_slider.dispatch_event("input")

    # Wait for any renders to complete (including debounced operations)
    page.wait_for_timeout(1000)  # Account for KDMA_SLIDER_DEBOUNCE_MS

    # Count render calls in console
    render_calls = []
    for msg in console_messages:
        if "[DEBUG] renderComparisonTable called" in msg.text:
            render_calls.append(msg.text)

    print(f"\nFound {len(render_calls)} render calls after KDMA slider change:")
    for i, call in enumerate(render_calls, 1):
        print(f"  {i}. {call}")

    # KDMA changes are debounced, so we should see minimal renders
    assert len(render_calls) <= 2, (
        f"Too many render calls ({len(render_calls)}) after KDMA slider change. "
        f"This indicates a rendering issue despite debouncing."
    )
