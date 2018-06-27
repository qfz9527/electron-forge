const fetch = require('node-fetch');
const fs = require('fs-extra');
const Listr = require('listr');
const path = require('path');

const workspaceMappings = {
  maker: {
    wix: 'wix-msi',
    squirrel: 'squirrel.windows',
    snap: 'snapcraft',
  },
  publisher: {},
  plugin: {},
};

const BASE_DIR = path.resolve(__dirname, '..');
const DOCS_BASE = 'https://raw.githubusercontent.com/MarshallOfSound/electron-forge-docs/v6';

const sanitize = (gb) => {
  return gb
    .replace('{% code-tabs %}', '')
    .replace('{% endcode-tabs %}', '')
    .replace(/{% code-tabs-item title=".+?" %}/g, '')
    .replace('{% endcode-tabs-item %}', '')
    .replace('{% endhint %}', '\n--------')
    .replace(/{% hint style="(.+?)" %}\n/g, (_, style) => {
      const styleMap = {
        warning: '⚠️',
        info: 'ℹ️',
        danger: '🚨',
      };
      return `\n--------\n\n${styleMap[style] || 'ℹ️'} `;
    });
};

const sync = () => {
  return new Listr([
    {
      title: 'Collecting package keys',
      task: async (ctx) => {
        ctx.packageKeys = [];

        for (const workspace of Object.keys(workspaceMappings)) {
          const workspaceDir = path.resolve(BASE_DIR, 'packages', workspace);

          for (const packageName of await fs.readdir(path.resolve(workspaceDir))) {
            const packageKey = workspaceMappings[workspace][packageName] || packageName;

            ctx.packageKeys.push([workspace, workspaceDir, packageKey, packageName]);
          }
        }
      },
    },
    {
      title: 'Fetching READMEs',
      task: (ctx) => new Listr(ctx.packageKeys.map(([workspace, workspaceDir, packageKey, packageName]) => ({
        title: `Fetching README for ${path.basename(workspaceDir)}/${packageKey}`,
        task: async () => {
          const r = await fetch(`${DOCS_BASE}/${workspace}s/${packageKey}.md`);
          if (r.status !== 200) return;

          const md = sanitize(await r.text());
          await fs.writeFile(path.resolve(workspaceDir, packageName, 'README.md'), md);
        },
      })), { concurrent: 5 }),
    },
  ]);
};

if (process.mainModule === module) {
  sync().run().catch(console.error);
}

module.exports = sync;
