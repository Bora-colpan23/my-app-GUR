module.exports = {
  root: true,
  env: { browser: true, es2021: true },
  extends: ['eslint:recommended', 'plugin:react/recommended'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  settings: { react: { version: '18.3' } },
  plugins: ['react'],
  rules: {
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
    'no-unused-vars': 'warn',
  },
  overrides: [
    {
      // Sunucu tarafı Node'da çalışıyor: process, Buffer, console tanımlı.
      // shared/ her iki ortamda da çalıştığı için ikisinin kesişimi geçerli.
      files: ['server/**/*.js', 'shared/**/*.js', '*.cjs'],
      env: { node: true, browser: false },
    },
  ],
};
