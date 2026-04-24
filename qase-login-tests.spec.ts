import { test, expect } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';
import Tesseract from 'tesseract.js';

const BASE_URL = 'https://bcm.ewqa.cc/';

async function solveCaptcha(page: any, maxAttempts: number = 5): Promise<string> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const captchaImg = page.locator('img[alt="Captcha"]');
      const imageUrl = await captchaImg.getAttribute('src');
      
      const base64Data = await page.evaluate(async (url: string) => {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }, imageUrl);
      
      const result = await Tesseract.recognize(base64Data, 'eng', {
        logger: () => {}
      });
      
      let captchaText = result.data.text.trim().replace(/\s/g, '').toUpperCase();
      captchaText = captchaText.replace(/[^A-Z0-9]/g, '');
      console.log(`Attempt ${attempt}: Captcha recognized: ${captchaText}`);
      
      if (captchaText.length >= 4) {
        return captchaText;
      }
      
      if (attempt < maxAttempts) {
        await page.locator('img[alt="Captcha"] + button').click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      console.log('Captcha error:', e);
    }
  }
  return '1234';
}

test.describe('登入功能測試', () => {
  test(qase(3, '登入頁面驗證碼登入'), async ({ page }) => {
    await page.goto(BASE_URL);
    
    await page.waitForLoadState('networkidle');
    
    await page.getByRole('textbox', { name: '公司代碼' }).fill('system');
    await page.getByRole('textbox', { name: '帳號' }).first().fill('manager');
    await page.locator('#Password').fill('Aa123456!');
    
    let loginSuccess = false;
    for (let i = 0; i < 3; i++) {
      const captchaText = await solveCaptcha(page);
      const captchaInput = page.getByRole('textbox').last();
      await captchaInput.fill(captchaText);
      
      await page.getByRole('button', { name: '登入' }).click();
      
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      console.log('Current URL:', currentUrl);
      
      if (!currentUrl.includes('/auth/login')) {
        loginSuccess = true;
        break;
      }
      
      const errorMsg = page.locator('text=驗證碼錯誤');
      if (await errorMsg.isVisible().catch(() => false)) {
        console.log('Captcha error, retrying...');
        await page.locator('img[alt="Captcha"] + button').click();
        await page.waitForTimeout(500);
      }
    }
    
    expect(loginSuccess).toBe(true);
  });
});