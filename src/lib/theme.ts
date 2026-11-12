export const themeDefinitions: Record<string, Record<string, string>> = {
  default: {
    '--theme-bg': '#101010',
    '--theme-card-bg': '#1C1C1C',
    '--theme-primary': '#FF3030',
    '--theme-accent': '#FF5050',
    '--theme-text': '#F5F5F5',
    '--theme-border': '#2A2A2A',
    '--theme-glow-color': 'rgba(255, 48, 48, 0.15)',
  },
  eternal: {
    '--theme-bg': '#101010',
    '--theme-card-bg': '#1C1C1C',
    '--theme-primary': '#FF3030',
    '--theme-accent': '#FF5050',
    '--theme-text': '#F5F5F5',
    '--theme-border': '#2A2A2A',
    '--theme-glow-color': 'rgba(255, 48, 48, 0.15)',
  },
  grace: {
    '--theme-bg': '#101010',
    '--theme-card-bg': '#1C1C1C',
    '--theme-primary': '#FF3030',
    '--theme-accent': '#FF5050',
    '--theme-text': '#F5F5F5',
    '--theme-border': '#2A2A2A',
    '--theme-glow-color': 'rgba(255, 48, 48, 0.15)',
  },
  candid: {
    '--theme-bg': '#101010',
    '--theme-card-bg': '#1C1C1C',
    '--theme-primary': '#FF3030',
    '--theme-accent': '#FF5050',
    '--theme-text': '#F5F5F5',
    '--theme-border': '#2A2A2A',
    '--theme-glow-color': 'rgba(255, 48, 48, 0.15)',
  },
  light: {
    '--theme-bg': '#101010',
    '--theme-card-bg': '#1C1C1C',
    '--theme-primary': '#FF3030',
    '--theme-accent': '#FF5050',
    '--theme-text': '#F5F5F5',
    '--theme-border': '#2A2A2A',
    '--theme-glow-color': 'rgba(255, 48, 48, 0.15)',
  }
};

export function applyThemeVariables(themeId: string) {
  const normalizedId = themeId === 'eteral' ? 'eternal' : themeId;
  const active = themeDefinitions[normalizedId] || themeDefinitions.default;
  Object.entries(active).forEach(([key, val]) => {
    document.documentElement.style.setProperty(key, val);
  });
  document.documentElement.setAttribute('data-theme', normalizedId);
}
