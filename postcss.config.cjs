const tailwindPostcss = require('@tailwindcss/postcss');

module.exports = {
  plugins: {
    '@tailwindcss/postcss': tailwindPostcss(),
    autoprefixer: {},
  },
};
