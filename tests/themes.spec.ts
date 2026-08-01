import { test } from './test';

test.describe('Test themes', () => {
  test.describe('Test color scheme preference', () => {
    test('should respect prefers-color-scheme light', async ({ page, editPage }) => {
      // Test light mode
      await page.emulateMedia({ colorScheme: 'light' });
      await editPage.start();
      await editPage.checkTheme('light');
    });

    test('should default to light even when the system prefers dark', async ({
      page,
      editPage
    }) => {
      // Diagrams are authored for documents and slides, which are light, so the
      // canvas defaults to light regardless of the OS setting. The toggle below
      // still lets anyone switch, and that choice is what persists.
      await page.emulateMedia({ colorScheme: 'dark' });
      await editPage.start();
      await editPage.checkTheme('light');
    });

    test('should change themes when clicked', async ({ editPage }) => {
      await editPage.toggleTheme();
      await editPage.checkTheme('dark');
      await editPage.toggleTheme();
      await editPage.checkTheme('light');
    });
  });
});
