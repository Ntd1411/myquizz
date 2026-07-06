// Helper functions cho authentication tests

/**
 * Đăng ký tài khoản mới
 * @param {import('@playwright/test').Page} page
 * @param {object} userData
 */
export async function register(page, userData) {
  await page.goto('/register')
  
  await page.fill('input[name="fullname"]', userData.fullname)
  await page.fill('input[name="email"]', userData.email)
  
  if (userData.phone) {
    await page.fill('input[name="phone"]', userData.phone)
  }
  
  await page.fill('input[name="password"]', userData.password)
  await page.fill('input[name="confirmPassword"]', userData.confirmPassword)
  
  // Tick checkbox đồng ý điều khoản
  await page.check('input[type="checkbox"][required]')
  
  await page.click('button[type="submit"]')
}

/**
 * Đăng nhập vào hệ thống
 * @param {import('@playwright/test').Page} page
 * @param {string} email
 * @param {string} password
 */
export async function login(page, email, password) {
  await page.goto('/login')
  
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  
  await page.click('button[type="submit"]')
}

/**
 * Đăng xuất khỏi hệ thống
 * @param {import('@playwright/test').Page} page
 */
export async function logout(page) {
  // Tìm và click vào nút logout trong menu
  await page.click('[data-testid="user-menu"]')
  await page.click('[data-testid="logout-button"]')
}

/**
 * Kiểm tra xem user đã đăng nhập chưa
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
export async function isLoggedIn(page) {
  try {
    await page.waitForSelector('[data-testid="user-menu"]', { timeout: 3000 })
    return true
  } catch {
    return false
  }
}

/**
 * Tạo user data ngẫu nhiên cho test
 * @returns {object}
 */
export function generateUserData() {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000)
  
  return {
    fullname: `Test User ${random}`,
    email: `testuser${timestamp}${random}@test.com`,
    username: `testuser${timestamp}${random}`,
    phone: `09${String(random).padStart(8, '0')}`,
    password: 'Test@123456',
    confirmPassword: 'Test@123456'
  }
}

/**
 * Đợi navigation sau khi đăng nhập thành công
 * @param {import('@playwright/test').Page} page
 */
export async function waitForLoginSuccess(page) {
  await page.waitForURL('**/app', { timeout: 10000 })
}

/**
 * Đợi navigation sau khi đăng ký thành công
 * @param {import('@playwright/test').Page} page
 */
export async function waitForRegisterSuccess(page) {
  await page.waitForURL('**/app', { timeout: 10000 })
}
