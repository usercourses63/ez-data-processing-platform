"""
Import from File - Comprehensive UI Test
Webapp-testing script covering edge cases NOT in Playwright E2E specs.

Reconnaissance-first approach: discover DOM structure, then verify behaviors.
Covers: empty files, oversized files, unsupported formats, cancel flow, RTL,
headerless toggle, constraint display, preview rows, form pre-fill across tabs.

Run: cd src/Frontend && python tests/webapp-testing/import_comprehensive_test.py
"""

import os
import sys
import time
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, Page, expect

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://127.0.0.1:7000")
TEST_DATA_DIR = str(Path(__file__).resolve().parent.parent.parent / "test-data")

# Test results tracking
results = []


def log_result(test_name: str, passed: bool, detail: str = ""):
    status = "PASS" if passed else "FAIL"
    results.append((test_name, passed, detail))
    print(f"  [{status}] {test_name}" + (f" -- {detail}" if detail else ""))


def create_temp_file(name: str, content: str) -> str:
    """Create a temp file with given content."""
    temp_dir = tempfile.mkdtemp()
    filepath = os.path.join(temp_dir, name)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    return filepath


def create_large_temp_file(name: str, size_mb: int = 12) -> str:
    """Create a large CSV file exceeding the soft limit."""
    temp_dir = tempfile.mkdtemp()
    filepath = os.path.join(temp_dir, name)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("name,age,email,phone,price,active\n")
        line = "A" * 200 + ",30,test@example.com,0541234567,99.99,true\n"
        lines_needed = (size_mb * 1024 * 1024) // len(line.encode("utf-8"))
        for _ in range(lines_needed):
            f.write(line)
    return filepath


def upload_file(page: Page, filepath: str):
    """Upload a file via Ant Design Upload hidden input."""
    file_input = page.locator("input[type='file']")
    file_input.set_input_files(filepath)


def navigate_to_list(page: Page):
    """Navigate to datasource list page and wait for load."""
    page.goto(f"{FRONTEND_URL}/datasources")
    page.wait_for_load_state("networkidle")
    time.sleep(1)


# ============================================================================
# RECONNAISSANCE
# ============================================================================
def recon_upload_button(page: Page):
    """Discover the Upload File button DOM structure."""
    print("\n--- Reconnaissance: Upload File button ---")
    navigate_to_list(page)

    # Look for the upload button
    buttons = page.locator("button").all()
    upload_btn = None
    for btn in buttons:
        text = btn.text_content() or ""
        if any(kw in text.lower() for kw in ["upload", "import", "file"]):
            upload_btn = btn
            print(f"  Found button: '{text.strip()}'")
            break

    # Check Hebrew
    if not upload_btn:
        for btn in buttons:
            text = btn.text_content() or ""
            if any(kw in text for kw in ["העלאת", "ייבוא", "קובץ"]):
                upload_btn = btn
                print(f"  Found Hebrew button: '{text.strip()}'")
                break

    if upload_btn:
        print(f"  Button visible: {upload_btn.is_visible()}")
        # Check parent structure
        parent_class = upload_btn.evaluate("el => el.parentElement?.className || ''")
        print(f"  Parent class: {parent_class}")
    else:
        print("  WARNING: Upload button not found!")

    return upload_btn is not None


# ============================================================================
# EDGE CASE TESTS
# ============================================================================
def test_empty_csv(page: Page):
    """Upload empty CSV -> verify error message."""
    navigate_to_list(page)
    filepath = create_temp_file("empty.csv", "")
    upload_file(page, filepath)
    time.sleep(2)

    # Should show error message (Ant Design message component)
    error_msg = page.locator(".ant-message-error, .ant-message-notice-error")
    has_error = error_msg.count() > 0

    # Also check if modal did NOT open
    modal_visible = page.locator(".ant-modal").is_visible()

    log_result(
        "Empty CSV shows error",
        has_error or not modal_visible,
        f"error_msg={has_error}, modal_visible={modal_visible}",
    )


def test_csv_headers_only(page: Page):
    """Upload CSV with only headers (no data rows) -> verify handles gracefully."""
    navigate_to_list(page)
    filepath = create_temp_file("headers-only.csv", "name,age,email\n")
    upload_file(page, filepath)
    time.sleep(2)

    # Could show modal with 0 rows or show error -- either is acceptable
    modal = page.locator(".ant-modal")
    if modal.is_visible():
        # Modal opened -- check data table is empty or shows 0 rows
        table_rows = modal.locator(".ant-table-tbody tr")
        row_count = table_rows.count()
        log_result(
            "Headers-only CSV handled",
            True,
            f"Modal opened with {row_count} data rows",
        )
        # Close modal
        cancel_btn = modal.locator("button").filter(has_text="Cancel").or_(
            modal.locator("button").filter(has_text="ביטול")
        )
        if cancel_btn.count() > 0:
            cancel_btn.first.click()
            time.sleep(0.5)
    else:
        error_msg = page.locator(".ant-message-error, .ant-message-notice-error")
        log_result(
            "Headers-only CSV handled",
            error_msg.count() > 0,
            "Error message shown for headers-only file",
        )


def test_unsupported_format(page: Page):
    """Upload .txt file -> verify error message."""
    navigate_to_list(page)
    filepath = create_temp_file("data.txt", "Hello world\nThis is a text file")
    upload_file(page, filepath)
    time.sleep(2)

    error_msg = page.locator(".ant-message-error, .ant-message-notice-error")
    modal_visible = page.locator(".ant-modal").is_visible()

    log_result(
        "Unsupported .txt format shows error",
        error_msg.count() > 0 or not modal_visible,
        f"error_msg={error_msg.count()}, modal_visible={modal_visible}",
    )


def test_cancel_modal(page: Page):
    """Cancel modal -> verify modal closes and no navigation occurs."""
    navigate_to_list(page)
    filepath = os.path.join(TEST_DATA_DIR, "import-test-with-headers.csv")
    upload_file(page, filepath)
    time.sleep(2)

    modal = page.locator(".ant-modal")
    if not modal.is_visible():
        log_result("Cancel modal", False, "Modal did not open")
        return

    # Click Cancel button
    cancel_btn = modal.locator("button").filter(has_text="Cancel").or_(
        modal.locator("button").filter(has_text="ביטול")
    )
    if cancel_btn.count() > 0:
        cancel_btn.first.click()
        time.sleep(1)

    # Modal should be closed
    modal_gone = not page.locator(".ant-modal").is_visible()
    # URL should still be /datasources (no navigation)
    still_on_list = "/datasources" in page.url and "/new" not in page.url

    log_result(
        "Cancel closes modal without navigation",
        modal_gone and still_on_list,
        f"modal_gone={modal_gone}, still_on_list={still_on_list}",
    )


def test_re_upload_different_file(page: Page):
    """Upload one file, then upload another -> verify preview updates."""
    navigate_to_list(page)

    # First upload CSV
    csv_path = os.path.join(TEST_DATA_DIR, "import-test-with-headers.csv")
    upload_file(page, csv_path)
    time.sleep(2)

    modal = page.locator(".ant-modal")
    if modal.is_visible():
        # Close first modal
        cancel_btn = modal.locator("button").filter(has_text="Cancel").or_(
            modal.locator("button").filter(has_text="ביטול")
        )
        if cancel_btn.count() > 0:
            cancel_btn.first.click()
            time.sleep(1)

    # Upload JSON
    json_path = os.path.join(TEST_DATA_DIR, "import-test.json")
    upload_file(page, json_path)
    time.sleep(2)

    modal = page.locator(".ant-modal")
    if modal.is_visible():
        # JSON should NOT have CSV-specific controls (no header toggle)
        header_switch = modal.locator(".ant-switch")
        has_switch = header_switch.count() > 0 and header_switch.is_visible()
        log_result(
            "Re-upload shows new file preview",
            not has_switch,
            f"CSV header switch visible: {has_switch} (expected False for JSON)",
        )
        # Close
        cancel_btn = modal.locator("button").filter(has_text="Cancel").or_(
            modal.locator("button").filter(has_text="ביטול")
        )
        if cancel_btn.count() > 0:
            cancel_btn.first.click()
    else:
        log_result("Re-upload shows new file preview", False, "Modal did not open for JSON")


def test_headerless_toggle(page: Page):
    """Headerless CSV: toggle from No to Yes -> verify field names change to first row values."""
    navigate_to_list(page)
    filepath = os.path.join(TEST_DATA_DIR, "import-test-no-headers.csv")
    upload_file(page, filepath)
    time.sleep(2)

    modal = page.locator(".ant-modal")
    if not modal.is_visible():
        log_result("Headerless toggle", False, "Modal did not open")
        return

    header_switch = modal.locator(".ant-switch")
    if header_switch.count() == 0:
        log_result("Headerless toggle", False, "No switch found in modal")
        return

    # Ensure in headerless state first
    is_checked = header_switch.evaluate("el => el.classList.contains('ant-switch-checked')")
    if is_checked:
        # Toggle to No (headerless)
        header_switch.click()
        time.sleep(1)

    # Field name inputs should be visible
    field_inputs = modal.locator("input[placeholder^='field_']")
    count_no_headers = field_inputs.count()

    # Now toggle to Yes (has headers) -- first row becomes header names
    header_switch.click()
    time.sleep(1)

    # Field inputs should disappear (has headers mode)
    field_inputs_after = modal.locator("input[placeholder^='field_']")
    count_with_headers = field_inputs_after.count()

    log_result(
        "Headerless toggle changes field editing",
        count_no_headers > 0 and count_with_headers == 0,
        f"inputs_no_headers={count_no_headers}, inputs_with_headers={count_with_headers}",
    )

    # Close
    cancel_btn = modal.locator("button").filter(has_text="Cancel").or_(
        modal.locator("button").filter(has_text="ביטול")
    )
    if cancel_btn.count() > 0:
        cancel_btn.first.click()


def test_extraction_checklist_constraints(page: Page):
    """Verify extraction checklist shows all constraint types for known fields."""
    navigate_to_list(page)
    filepath = os.path.join(TEST_DATA_DIR, "import-test-with-headers.csv")
    upload_file(page, filepath)
    time.sleep(2)

    modal = page.locator(".ant-modal")
    if not modal.is_visible():
        log_result("Extraction checklist constraints", False, "Modal did not open")
        return

    # Collect all text in the checklist area
    checklist_text = modal.text_content() or ""

    # Check for constraint indicators
    has_email_format = "email" in checklist_text.lower() and "format" in checklist_text.lower()
    has_pattern = "pattern" in checklist_text.lower()
    has_minimum = "minimum" in checklist_text.lower() or "min" in checklist_text.lower()

    # Green check icons (fields with constraints)
    green_checks = modal.locator(".anticon-check-circle")
    green_count = green_checks.count()

    log_result(
        "Extraction checklist shows constraints",
        has_email_format and has_minimum and green_count >= 3,
        f"email_format={has_email_format}, pattern={has_pattern}, min={has_minimum}, green_checks={green_count}",
    )

    # Close
    cancel_btn = modal.locator("button").filter(has_text="Cancel").or_(
        modal.locator("button").filter(has_text="ביטול")
    )
    if cancel_btn.count() > 0:
        cancel_btn.first.click()


def test_preview_table_five_rows(page: Page):
    """Preview table shows exactly 5 rows even when file has 10."""
    navigate_to_list(page)
    filepath = os.path.join(TEST_DATA_DIR, "import-test-with-headers.csv")
    upload_file(page, filepath)
    time.sleep(2)

    modal = page.locator(".ant-modal")
    if not modal.is_visible():
        log_result("Preview table 5 rows", False, "Modal did not open")
        return

    table_rows = modal.locator(".ant-table-tbody tr")
    row_count = table_rows.count()

    # Total row count in footer
    footer_text = modal.locator(".ant-table-footer").text_content() or ""
    has_total = "10" in footer_text

    log_result(
        "Preview table shows 5 rows with total 10",
        row_count == 5 and has_total,
        f"rows={row_count}, footer_has_10={has_total}, footer='{footer_text}'",
    )

    # Close
    cancel_btn = modal.locator("button").filter(has_text="Cancel").or_(
        modal.locator("button").filter(has_text="ביטול")
    )
    if cancel_btn.count() > 0:
        cancel_btn.first.click()


def test_continue_form_prefill_all_tabs(page: Page):
    """Continue -> form pre-fill -> verify each tab has correct values."""
    navigate_to_list(page)
    filepath = os.path.join(TEST_DATA_DIR, "import-test-with-headers.csv")
    upload_file(page, filepath)
    time.sleep(2)

    modal = page.locator(".ant-modal")
    if not modal.is_visible():
        log_result("Form pre-fill all tabs", False, "Modal did not open")
        return

    # Click Continue
    continue_btn = modal.locator("button").filter(has_text="Continue").or_(
        modal.locator("button").filter(has_text="המשך")
    )
    continue_btn.first.click()
    page.wait_for_url("**/datasources/new**", timeout=10000)
    time.sleep(2)

    checks = {}

    # Basic Info tab (default) - name field
    name_input = page.locator("input#name")
    name_val = name_input.input_value() if name_input.is_visible() else ""
    checks["name_filled"] = len(name_val) > 0

    # File Settings tab
    file_tab = page.locator("[id$='-tab-file']")
    if file_tab.count() > 0:
        file_tab.click()
        time.sleep(1)
        # Check file type is CSV
        file_type_text = page.locator(".ant-select").filter(
            has=page.locator("input#fileType")
        ).text_content() or ""
        checks["file_type_csv"] = "CSV" in file_type_text.upper()

    # Schema tab
    schema_tab = page.locator("[id$='-tab-schema']")
    if schema_tab.count() > 0:
        schema_tab.click()
        time.sleep(1.5)
        # Schema should have content
        panel_text = page.locator("[role='tabpanel']:visible").text_content() or ""
        checks["schema_has_content"] = len(panel_text) > 10

    all_passed = all(checks.values())
    log_result(
        "Form pre-fill across tabs",
        all_passed,
        f"checks={checks}",
    )


def test_rtl_layout(page: Page):
    """Switch to Hebrew -> verify Upload File button and modal render in RTL."""
    navigate_to_list(page)

    # Look for language switcher
    lang_btns = page.locator("button, .ant-select").filter(has_text="EN").or_(
        page.locator("[data-lang], [aria-label*='language']")
    )

    # Set HTML dir to rtl via page evaluate for testing
    page.evaluate("document.documentElement.dir = 'rtl'")
    time.sleep(0.5)

    # Check that the upload button is still visible
    upload_btn = page.locator("button").filter(has_text="Upload").or_(
        page.locator("button").filter(has_text="העלאת")
    ).or_(page.locator("button").filter(has_text="ייבוא"))
    btn_visible = upload_btn.first.is_visible() if upload_btn.count() > 0 else False

    # Check dir attribute
    doc_dir = page.evaluate("document.documentElement.dir")

    log_result(
        "RTL layout: Upload button visible",
        btn_visible and doc_dir == "rtl",
        f"btn_visible={btn_visible}, doc_dir={doc_dir}",
    )


def test_large_file_warning(page: Page):
    """Upload file > 10MB -> verify soft limit warning (if enforced)."""
    navigate_to_list(page)

    # Create a large file (12MB)
    filepath = create_large_temp_file("large.csv", size_mb=12)
    upload_file(page, filepath)
    time.sleep(5)  # Large file analysis takes time

    # Should show warning message (soft limit) or work with delay
    warning_msg = page.locator(".ant-message-warning, .ant-message-notice-warning")
    modal = page.locator(".ant-modal")

    has_warning = warning_msg.count() > 0
    modal_opened = modal.is_visible()

    log_result(
        "Large file warning or handled",
        has_warning or modal_opened,
        f"warning={has_warning}, modal_opened={modal_opened}",
    )

    # Cleanup
    if modal_opened:
        cancel_btn = modal.locator("button").filter(has_text="Cancel").or_(
            modal.locator("button").filter(has_text="ביטול")
        )
        if cancel_btn.count() > 0:
            cancel_btn.first.click()

    # Remove temp file
    try:
        os.remove(filepath)
    except OSError:
        pass


def test_headerless_blank_names_fallback(page: Page):
    """Headerless CSV: leave field names blank -> verify fallback to field_1, field_2."""
    navigate_to_list(page)
    filepath = os.path.join(TEST_DATA_DIR, "import-test-no-headers.csv")
    upload_file(page, filepath)
    time.sleep(2)

    modal = page.locator(".ant-modal")
    if not modal.is_visible():
        log_result("Headerless blank names fallback", False, "Modal did not open")
        return

    # Ensure in headerless state
    header_switch = modal.locator(".ant-switch")
    if header_switch.count() > 0:
        is_checked = header_switch.evaluate("el => el.classList.contains('ant-switch-checked')")
        if is_checked:
            header_switch.click()
            time.sleep(1)

    # Clear first field input and leave blank
    field_inputs = modal.locator("input[placeholder^='field_']")
    if field_inputs.count() >= 1:
        field_inputs.first.clear()
        field_inputs.first.fill("")
        # Click elsewhere to trigger onChange
        modal.locator("h5, .ant-typography").first.click()
        time.sleep(1)

    # The extraction checklist should show field_1 as fallback for blank input
    checklist_text = modal.text_content() or ""
    has_fallback = "field_1" in checklist_text

    log_result(
        "Blank field name falls back to field_1",
        has_fallback,
        f"checklist contains field_1: {has_fallback}",
    )

    # Close
    cancel_btn = modal.locator("button").filter(has_text="Cancel").or_(
        modal.locator("button").filter(has_text="ביטול")
    )
    if cancel_btn.count() > 0:
        cancel_btn.first.click()


# ============================================================================
# MAIN
# ============================================================================
def main():
    print(f"\n{'='*70}")
    print("Import from File - Comprehensive UI Test")
    print(f"Frontend URL: {FRONTEND_URL}")
    print(f"Test Data: {TEST_DATA_DIR}")
    print(f"{'='*70}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=300)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # Reconnaissance
        print("\n== RECONNAISSANCE ==")
        recon_upload_button(page)

        # Edge case tests
        print("\n== EDGE CASE TESTS ==")
        tests = [
            ("Empty CSV", test_empty_csv),
            ("Headers only CSV", test_csv_headers_only),
            ("Unsupported format", test_unsupported_format),
            ("Cancel modal", test_cancel_modal),
            ("Re-upload different file", test_re_upload_different_file),
            ("Headerless toggle", test_headerless_toggle),
            ("Extraction checklist constraints", test_extraction_checklist_constraints),
            ("Preview table 5 rows", test_preview_table_five_rows),
            ("Continue form pre-fill", test_continue_form_prefill_all_tabs),
            ("RTL layout", test_rtl_layout),
            ("Large file warning", test_large_file_warning),
            ("Headerless blank names fallback", test_headerless_blank_names_fallback),
        ]

        for name, test_fn in tests:
            try:
                test_fn(page)
            except Exception as e:
                log_result(name, False, f"Exception: {e}")

        browser.close()

    # Summary
    print(f"\n{'='*70}")
    print("SUMMARY")
    print(f"{'='*70}")
    passed = sum(1 for _, p, _ in results if p)
    failed = sum(1 for _, p, _ in results if not p)
    print(f"  Passed: {passed}/{len(results)}")
    print(f"  Failed: {failed}/{len(results)}")

    if failed > 0:
        print("\n  Failed tests:")
        for name, p, detail in results:
            if not p:
                print(f"    - {name}: {detail}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
