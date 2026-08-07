This is a Slack agent template for [eve](https://beta.eve.dev).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel-labs%2Feve-slack-agent-template%2Ftree%2Fmain&connect=%5B%7B%22type%22%3A%22slack%22%2C%22env%22%3A%22SLACK_CONNECTOR%22%2C%22triggers%22%3Atrue%2C%22triggerPath%22%3A%22%2Feve%2Fv1%2Fslack%22%7D%5D)


## Getting Started

First, link the project and pull environment variables:

```bash
vercel link
vercel env pull
```

Then, run the development server:

```bash
pnpm dev
```

You can start editing the agent by modifying `agent/agent.ts`. Its behavior is defined in `agent/instructions.md`, and tools live in `agent/tools/`. The agent auto-updates as you edit the files.

This project uses the Eve framework's bundled guides — see `node_modules/eve/dist/docs/public/` after installing dependencies.

## Learn More

To learn more about eve, take a look at the following resources:

- [Eve Documentation](https://beta.eve.dev/docs/introduction) - learn about Eve features and API.
- [Vercel Connect](https://vercel.com/docs) - manages the Slack channel's credentials in this template.

You can check out [the Eve GitHub repository](https://github.com/vercel/eve) - your feedback and contributions are welcome!

<img width="1552" height="1013" alt="Image Edit Request" src="https://github.com/user-attachments/assets/115c947d-1b7d-4464-8d57-91f2dd8758f0" />
