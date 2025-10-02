#!/usr/bin/env python3
"""
Shared pytest fixtures for frontend testing.
"""

import threading
import time
import http.server
import socketserver
from pathlib import Path
from contextlib import contextmanager
import pytest
from playwright.sync_api import sync_playwright


@contextmanager
def wait_for_new_experiment_result(page, timeout=10000):
    """
    Context manager that waits for a new experiment result to load after a parameter change.

    This monitors the data-experiment-key attribute which changes when a different
    experiment is resolved and loaded.

    Args:
        page: Playwright page object
        timeout: Timeout in milliseconds

    Usage:
        with wait_for_new_experiment_result(page):
            # Make parameter change here
            adm_select.select_option("pipeline_baseline")
        # Context manager waits for new experiment result to load
    """
    # Get current experiment keys from all runs
    current_keys = page.evaluate(
        """() => {
            const headers = document.querySelectorAll('th[data-experiment-key]');
            return Array.from(headers).map(h => h.getAttribute('data-experiment-key'));
        }"""
    )

    yield

    # Wait for any experiment key to change
    page.wait_for_function(
        f"""() => {{
            const headers = document.querySelectorAll('th[data-experiment-key]');
            const newKeys = Array.from(headers).map(h => h.getAttribute('data-experiment-key'));
            const currentKeys = {current_keys};
            
            if (newKeys.length !== currentKeys.length) return true;
            return newKeys.some((key, index) => key !== currentKeys[index]);
        }}""",
        timeout=timeout,
    )


def ensure_select_value(page, selector, value):
    """
    Utility function to ensure a select element has a specific value.
    Only changes the value if it's different from the current value.
    Uses wait_for_new_experiment_result context manager when a change is made.

    Args:
        page: Playwright page object
        selector: CSS selector for the select element
        value: The value to ensure is selected

    Returns:
        bool: True if a change was made, False if value was already selected
    """
    select_element = page.locator(selector).first
    current_value = select_element.input_value()

    if current_value != value:
        with wait_for_new_experiment_result(page):
            select_element.select_option(value)
        return True
    else:
        # Value already selected, just wait for UI to stabilize
        page.wait_for_load_state("networkidle")
        return False


def ensure_kdma_slider_value(page, selector, value):
    """
    Utility function to ensure a KDMA slider has a specific value.
    Only changes the value if it's different from the current value.
    Uses wait_for_new_experiment_result context manager when a change is made.

    Args:
        page: Playwright page object
        selector: CSS selector for the slider element (or use page.locator result)
        value: The value to ensure is set (as string)

    Returns:
        bool: True if a change was made, False if value was already set
    """
    if hasattr(selector, "input_value"):
        # selector is already a locator
        slider_element = selector
    else:
        # selector is a CSS string
        slider_element = page.locator(selector).first

    current_value = slider_element.input_value()

    if current_value != str(value):
        with wait_for_new_experiment_result(page):
            slider_element.evaluate(f"slider => slider.value = '{value}'")
            slider_element.dispatch_event("input")
        return True
    else:
        # Value already set, just wait for UI to stabilize
        page.wait_for_load_state("networkidle")
        return False


def ensure_dropdown_selection(page, selector, required_value, description="dropdown"):
    """
    Ensures a dropdown has the required value selected.
    Fails if the required value cannot be ensured (either by selection or auto-selection).

    Args:
        page: Playwright page object
        selector: CSS selector for the select element
        required_value: The required value that must be selected
        description: Human-readable description for error messages

    Raises:
        AssertionError: If the required value cannot be ensured
    """
    dropdown = page.locator(selector).first

    if dropdown.is_enabled():
        # Dropdown is enabled - try to select the required value
        dropdown.select_option(required_value)
        page.wait_for_load_state("networkidle")

    # Verify the required value is now selected (whether we selected it or it was auto-selected)
    current_value = dropdown.input_value()
    assert current_value == required_value, (
        f"{description} dropdown must have '{required_value}' selected, but has '{current_value}'"
    )


class FrontendTestServer:
    """HTTP server for serving the built frontend during tests."""

    def __init__(self, dist_dir="dist", port=0):
        self.dist_dir = Path(dist_dir)
        self.port = port
        self.actual_port = None
        self.base_url = None
        self.server = None
        self.server_thread = None

    @contextmanager
    def run(self):
        """Context manager for running the test server."""

        class QuietHandler(http.server.SimpleHTTPRequestHandler):
            def log_message(self, format, *args):
                pass  # Suppress logging

        original_cwd = Path.cwd()

        try:
            # Change to dist directory
            if self.dist_dir.exists():
                import os

                os.chdir(self.dist_dir)

            # Start server in background thread
            class ReusableTCPServer(socketserver.TCPServer):
                allow_reuse_address = True

            with ReusableTCPServer(("", self.port), QuietHandler) as httpd:
                self.server = httpd
                self.actual_port = httpd.server_address[1]
                self.base_url = f"http://localhost:{self.actual_port}"

                self.server_thread = threading.Thread(
                    target=httpd.serve_forever, daemon=True
                )
                self.server_thread.start()

                # Wait for server to be ready
                time.sleep(0.1)  # Reduced from 0.5

                yield self.base_url

        finally:
            # Restore original directory
            import os

            os.chdir(original_cwd)

            if self.server:
                self.server.shutdown()


@pytest.fixture(scope="session")
def frontend_with_real_data():
    """Prepare frontend build directory with real experiment data."""
    project_root = Path(__file__).parent.parent

    # Use a dedicated test build directory for real data under temp
    temp_dir = project_root / "temp"
    temp_dir.mkdir(exist_ok=True)
    frontend_dir = temp_dir / "test-build-real"
    frontend_dir.mkdir(exist_ok=True)

    # Ensure experiment data is downloaded
    experiment_data_dir = project_root / "experiment-data"
    test_experiments_dir = experiment_data_dir / "test-experiments"
    lock_file = experiment_data_dir / ".download_lock"

    # Download experiments if test-experiments directory doesn't exist
    if not test_experiments_dir.exists():
        # Use file-based locking to prevent race conditions in parallel tests
        experiment_data_dir.mkdir(exist_ok=True)

        # Simple file-based lock for cross-platform compatibility
        max_wait = 60  # seconds
        wait_time = 0

        while lock_file.exists() and wait_time < max_wait:
            time.sleep(0.5)
            wait_time += 0.5

        if not test_experiments_dir.exists():
            try:
                # Create lock file
                lock_file.touch()

                print("Downloading experiment data for tests...")
                import urllib.request
                import zipfile

                zip_path = experiment_data_dir / "experiments.zip"

                # Download the zip file
                url = "https://github.com/PaulHax/align-browser/releases/download/v0.2.1/experiments.zip"
                print(f"Downloading {url}...")

                urllib.request.urlretrieve(url, zip_path)
                print(f"Downloaded to {zip_path}")

                # Extract the zip file to a temporary directory first
                print(f"Extracting {zip_path}...")
                temp_extract_dir = experiment_data_dir / "temp_extract"
                temp_extract_dir.mkdir(exist_ok=True)

                with zipfile.ZipFile(zip_path, "r") as zip_ref:
                    zip_ref.extractall(temp_extract_dir)

                # Find extracted directories in temp location
                extracted_items = list(temp_extract_dir.iterdir())
                extracted_dirs = [item for item in extracted_items if item.is_dir()]

                if len(extracted_dirs) == 1:
                    # Single directory - rename it to test-experiments
                    original_dir = extracted_dirs[0]
                    original_dir.rename(test_experiments_dir)
                    print(f"Renamed {original_dir.name} to test-experiments")
                elif len(extracted_dirs) > 1:
                    # Multiple directories - create test-experiments and move all under it
                    test_experiments_dir.mkdir(exist_ok=True)
                    for extracted_dir in extracted_dirs:
                        target_path = test_experiments_dir / extracted_dir.name
                        extracted_dir.rename(target_path)
                    print(
                        f"Moved {len(extracted_dirs)} directories under test-experiments"
                    )
                else:
                    # No directories found - this shouldn't happen but handle gracefully
                    print("Warning: No directories found in extracted zip")

                # Clean up temporary extraction directory
                import shutil

                if temp_extract_dir.exists():
                    shutil.rmtree(temp_extract_dir)

                # Delete the zip file after extraction
                zip_path.unlink()
                print(f"Extracted to {experiment_data_dir}")
                print("Experiment data ready for testing!")

            finally:
                # Clean up temporary extraction directory if it exists
                temp_extract_dir = experiment_data_dir / "temp_extract"
                if temp_extract_dir.exists():
                    import shutil

                    shutil.rmtree(temp_extract_dir)

                # Always remove lock file
                if lock_file.exists():
                    lock_file.unlink()

    # Use the test-experiments directory for real experiment data
    real_experiments_root = experiment_data_dir / "test-experiments"

    if not real_experiments_root.exists() or not any(real_experiments_root.iterdir()):
        pytest.skip(f"Real experiment data not found at {real_experiments_root}")

    # Use the build system to generate data with real experiments
    from .build import build_frontend

    build_frontend(
        experiments_root=real_experiments_root,
        output_dir=frontend_dir,
        dev_mode=False,  # Full build for tests
        build_only=True,
    )

    yield frontend_dir

    # Cleanup test build directory
    import shutil

    if frontend_dir.exists():
        shutil.rmtree(frontend_dir)


@pytest.fixture(scope="session")
def real_data_test_server(frontend_with_real_data):
    """Provide a running test server with real experiment data."""
    server = FrontendTestServer(
        frontend_with_real_data, port=0
    )  # Use any available port
    with server.run() as base_url:
        yield base_url


@pytest.fixture(scope="session")
def browser_context():
    """Provide a browser context."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)  # Use headless mode for speed
        context = browser.new_context()
        yield context
        context.close()
        browser.close()


@pytest.fixture
def page(browser_context):
    """Provide a browser page."""
    page = browser_context.new_page()
    yield page
    page.close()
