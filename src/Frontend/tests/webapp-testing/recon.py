"""Reconnaissance script - discover DOM structure of the datasource list page"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 900})

    print("=== NAVIGATING TO DATASOURCE LIST ===")
    page.goto('http://172.30.22.206:32608/datasources')
    page.wait_for_selector('.ant-table-tbody tr', timeout=30000)
    page.wait_for_timeout(2000)

    # Screenshot the list page
    page.screenshot(path='test-results/recon-list.png', full_page=False)

    # Get first row structure
    first_row = page.locator('.ant-table-tbody tr').first
    buttons = first_row.locator('button').all()
    print(f"\n=== FIRST ROW: {len(buttons)} buttons ===")
    for i, btn in enumerate(buttons):
        icon_class = btn.locator('span[class*="anticon"]').first.get_attribute('class') if btn.locator('span[class*="anticon"]').count() > 0 else 'no-icon'
        text = btn.text_content().strip()
        print(f"  Button {i}: text='{text}', icon='{icon_class}'")

    # Get all anticon types in first row
    icons = first_row.locator('span[class*="anticon-"]').all()
    print(f"\n=== ICONS IN FIRST ROW: {len(icons)} ===")
    for icon in icons:
        cls = icon.get_attribute('class')
        # Extract icon name from class
        for c in cls.split():
            if c.startswith('anticon-') and c != 'anticon':
                print(f"  {c}")

    # Click clone button and check what happens
    print("\n=== CLICKING CLONE (copy icon) ===")
    clone_btn = first_row.locator('button .anticon-copy').locator('..')
    clone_btn.click()
    page.wait_for_timeout(3000)

    # Check for modal
    modal = page.locator('.ant-modal-confirm')
    if modal.is_visible():
        print("MODAL VISIBLE!")
        title = modal.locator('.ant-modal-confirm-title').text_content()
        body = modal.locator('.ant-modal-confirm-content').text_content()
        print(f"  Title: {title}")
        print(f"  Body: {body[:100]}")
        page.screenshot(path='test-results/recon-modal.png')

        # Confirm and check navigation
        modal.locator('.ant-btn-primary').click()
        page.wait_for_timeout(3000)
        print(f"  URL after confirm: {page.url}")

        if '/new' in page.url:
            page.screenshot(path='test-results/recon-clone-form.png')

            # Check form fields
            inputs = page.locator('input').all()
            print(f"\n=== CLONE FORM: {len(inputs)} input fields ===")
            for inp in inputs[:10]:
                inp_id = inp.get_attribute('id') or 'no-id'
                inp_val = inp.input_value()
                print(f"  #{inp_id}: '{inp_val[:50]}'")

            # Check page title
            title_el = page.locator('h2').first
            if title_el.is_visible():
                print(f"  Page title: {title_el.text_content()}")
    else:
        print("NO MODAL - checking console errors")
        page.screenshot(path='test-results/recon-no-modal.png')

    # Go back to list and test delete
    print("\n=== TESTING DELETE POPCONFIRM ===")
    page.goto('http://172.30.22.206:32608/datasources')
    page.wait_for_selector('.ant-table-tbody tr', timeout=30000)
    page.wait_for_timeout(2000)

    first_row = page.locator('.ant-table-tbody tr').first
    delete_btn = first_row.locator('button .anticon-delete').locator('..')
    delete_btn.click()
    page.wait_for_timeout(1000)

    popconfirm = page.locator('.ant-popconfirm, .ant-popover')
    if popconfirm.is_visible():
        print("DELETE POPCONFIRM VISIBLE!")
        page.screenshot(path='test-results/recon-delete.png')
        page.keyboard.press('Escape')
    else:
        print("DELETE POPCONFIRM NOT VISIBLE")

    # Test details page clone
    print("\n=== TESTING DETAILS PAGE CLONE ===")
    page.goto('http://172.30.22.206:32608/datasources')
    page.wait_for_selector('.ant-table-tbody tr', timeout=30000)
    page.wait_for_timeout(2000)

    first_row = page.locator('.ant-table-tbody tr').first
    view_btn = first_row.locator('button .anticon-eye').locator('..')
    view_btn.click()
    page.wait_for_url('**/datasources/**', timeout=15000)
    page.wait_for_timeout(3000)

    page.screenshot(path='test-results/recon-details.png')

    # Check for clone button on details page
    details_clone = page.locator('button .anticon-copy').locator('..')
    if details_clone.is_visible():
        print("DETAILS CLONE BUTTON VISIBLE!")
        details_clone.click()
        page.wait_for_timeout(3000)

        modal2 = page.locator('.ant-modal-confirm')
        if modal2.is_visible():
            print("DETAILS CLONE MODAL VISIBLE!")
            page.screenshot(path='test-results/recon-details-modal.png')
            modal2.locator('.ant-btn:not(.ant-btn-primary)').click()  # Cancel
        else:
            print("DETAILS CLONE MODAL NOT VISIBLE")
    else:
        print("DETAILS CLONE BUTTON NOT FOUND")

    print("\n=== RECON COMPLETE ===")
    browser.close()
