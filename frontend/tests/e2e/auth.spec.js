import { test, expect } from '@playwright/test'
import { register, login, logout, generateUserData, waitForLoginSuccess, waitForRegisterSuccess } from '../helpers/auth.helper.js'
import { testUsers, invalidUserData } from '../fixtures/test-data.js'

test.describe('Đăng ký tài khoản', () => {
  test('Đăng ký thành công với thông tin hợp lệ', async ({ page }) => {
    const userData = generateUserData()
    
    await register(page, userData)
    
    await waitForRegisterSuccess(page)
    expect(page.url()).toContain('/app')
  })
  
  test('Hiển thị lỗi khi email đã tồn tại', async ({ page }) => {
    const userData = generateUserData()
    
    await register(page, userData)
    await waitForRegisterSuccess(page)
    
    await logout(page)
    
    await register(page, userData)
    
    await expect(page.locator('text=/email.*đã tồn tại/i')).toBeVisible({ timeout: 5000 })
  })
  
  test('Hiển thị lỗi khi email không hợp lệ', async ({ page }) => {
    const userData = {
      ...generateUserData(),
      email: 'invalid-email'
    }
    
    await page.goto('/register')
    await page.fill('input[name="fullname"]', userData.fullname)
    await page.fill('input[name="email"]', userData.email)
    await page.fill('input[name="username"]', userData.username)
    await page.fill('input[name="password"]', userData.password)
    await page.fill('input[name="confirmPassword"]', userData.confirmPassword)
    
    await page.click('button[type="submit"]')
    
    await expect(page.locator('text=/email.*hợp lệ/i')).toBeVisible()
  })
  
  test('Hiển thị lỗi khi mật khẩu quá ngắn', async ({ page }) => {
    const userData = {
      ...generateUserData(),
      password: '123',
      confirmPassword: '123'
    }
    
    await page.goto('/register')
    await page.fill('input[name="fullname"]', userData.fullname)
    await page.fill('input[name="email"]', userData.email)
    await page.fill('input[name="username"]', userData.username)
    await page.fill('input[name="password"]', userData.password)
    await page.fill('input[name="confirmPassword"]', userData.confirmPassword)
    
    await page.click('button[type="submit"]')
    
    await expect(page.locator('text=/mật khẩu.*8 ký tự/i')).toBeVisible()
  })
  
  test('Hiển thị lỗi khi mật khẩu xác nhận không khớp', async ({ page }) => {
    const userData = {
      ...generateUserData(),
      confirmPassword: 'DifferentPassword@123'
    }
    
    await page.goto('/register')
    await page.fill('input[name="fullname"]', userData.fullname)
    await page.fill('input[name="email"]', userData.email)
    await page.fill('input[name="username"]', userData.username)
    await page.fill('input[name="password"]', userData.password)
    await page.fill('input[name="confirmPassword"]', userData.confirmPassword)
    
    await page.click('button[type="submit"]')
    
    await expect(page.locator('text=/mật khẩu.*không khớp/i')).toBeVisible()
  })
  
  test('Hiển thị lỗi khi các trường bắt buộc để trống', async ({ page }) => {
    await page.goto('/register')
    
    await page.click('button[type="submit"]')
    
    const errorMessages = page.locator('text=/không được để trống|bắt buộc/i')
    await expect(errorMessages.first()).toBeVisible()
  })
  
  test('Toggle hiển thị mật khẩu hoạt động đúng', async ({ page }) => {
    await page.goto('/register')
    
    const passwordInput = page.locator('input[name="password"]')
    const toggleButton = page.locator('[data-testid="toggle-password"]').first()
    
    await expect(passwordInput).toHaveAttribute('type', 'password')
    
    await toggleButton.click()
    await expect(passwordInput).toHaveAttribute('type', 'text')
    
    await toggleButton.click()
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })
})

test.describe('Đăng nhập', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    const userData = generateUserData()
    
    await register(page, userData)
    await page.context().storageState({ path: 'tests/.auth/user.json' })
    await page.close()
  })
  
  test('Đăng nhập thành công với thông tin hợp lệ', async ({ page }) => {
    const userData = generateUserData()
    
    await register(page, userData)
    await logout(page)
    
    await login(page, userData.email, userData.password)
    
    await waitForLoginSuccess(page)
    expect(page.url()).toContain('/app')
    
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
  })
  
  test('Hiển thị lỗi khi email không tồn tại', async ({ page }) => {
    await login(page, 'notexist@test.com', 'Test@123456')
    
    await expect(page.locator('text=/email.*không tồn tại|sai/i')).toBeVisible({ timeout: 5000 })
  })
  
  test('Hiển thị lỗi khi mật khẩu sai', async ({ page }) => {
    const userData = generateUserData()
    
    await register(page, userData)
    await logout(page)
    
    await login(page, userData.email, 'WrongPassword@123')
    
    await expect(page.locator('text=/mật khẩu.*sai|không đúng/i')).toBeVisible({ timeout: 5000 })
  })
  
  test('Hiển thị lỗi khi email để trống', async ({ page }) => {
    await page.goto('/login')
    
    await page.fill('input[name="password"]', 'Test@123456')
    await page.click('button[type="submit"]')
    
    await expect(page.locator('text=/email.*không được để trống|bắt buộc/i')).toBeVisible()
  })
  
  test('Hiển thị lỗi khi mật khẩu để trống', async ({ page }) => {
    await page.goto('/login')
    
    await page.fill('input[name="email"]', 'test@test.com')
    await page.click('button[type="submit"]')
    
    await expect(page.locator('text=/mật khẩu.*không được để trống|bắt buộc/i')).toBeVisible()
  })
  
  test('Toggle hiển thị mật khẩu hoạt động đúng', async ({ page }) => {
    await page.goto('/login')
    
    const passwordInput = page.locator('input[name="password"]')
    const toggleButton = page.locator('[data-testid="toggle-password"]')
    
    await expect(passwordInput).toHaveAttribute('type', 'password')
    
    await toggleButton.click()
    await expect(passwordInput).toHaveAttribute('type', 'text')
    
    await toggleButton.click()
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })
  
  test('Link đăng ký hoạt động', async ({ page }) => {
    await page.goto('/login')
    
    await page.click('a:has-text("Đăng ký")')
    
    expect(page.url()).toContain('/register')
  })
})

test.describe('Đăng xuất', () => {
  test('Đăng xuất thành công', async ({ page }) => {
    const userData = generateUserData()
    
    await register(page, userData)
    await waitForRegisterSuccess(page)
    
    await logout(page)
    
    await page.waitForURL('**/', { timeout: 5000 })
    expect(page.url()).not.toContain('/app')
    
    await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible()
  })
})
