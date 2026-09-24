import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // The protocol entry point carries the zod schemas; the browser only needs its types and constants.
    files: ['apps/web/src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@deal-city/protocol',
              allowTypeImports: true,
              message: 'Value imports pull zod into the bundle; use @deal-city/protocol/constants.',
            },
          ],
        },
      ],
    },
  },
);
