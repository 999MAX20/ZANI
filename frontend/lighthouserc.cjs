module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run preview -- --port 4173",
      startServerReadyPattern: "Local:",
      url: ["http://localhost:4173/app/leads"],
      numberOfRuns: 1,
      settings: {
        preset: "desktop",
        chromeFlags: "--no-sandbox --headless=new",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.75 }],
        "categories:accessibility": ["warn", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:seo": "off",
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
