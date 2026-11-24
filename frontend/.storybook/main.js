/** @type { import('@storybook/nextjs').StorybookConfig } */
const config = {
  stories: [
    '../src/stories/**/*.stories.@(js|jsx|ts|tsx|mdx)',
    '../src/stories/**/*.mdx',
  ],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  staticDirs: ['../public'],
};

module.exports = config;
