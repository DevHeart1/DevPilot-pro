# Contributing to DevPilot

Thank you for your interest in contributing to DevPilot! As an enterprise-focused project, we maintain high standards for code quality, security, and documentation.

## 🤝 Code of Conduct
We expect all contributors to adhere to professional standards of conduct, fostering an inclusive and collaborative environment.

## 🛠️ Development Workflow

### 1. Setup
Ensure you have Node.js v20+ and have followed the installation steps in the main [README.md](../README.md).

### 2. Branching Strategy
-   `main`: Production-ready code.
-   `feature/*`: New capabilities.
-   `fix/*`: Bug fixes.
-   `chore/*`: Maintenace tasks.

### 3. Standards
-   **TypeScript**: All new code must be strictly typed.
-   **Formatting**: We use Prettier. Run `npm run format` (if configured) or ensure your IDE supports `.prettierrc`.
-   **Linting**: We use ESLint Flat Config. Run `npm run lint` before committing.
-   **Modularization**: Avoid large components. Prefer custom hooks and focused functional components.

## 🧪 Testing
We use Vitest for unit testing. Please ensure all new features include relevant test coverage.
```bash
npm test
```

## 📝 Commit Messages
We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
-   `feat:`: A new feature
-   `fix:`: A bug fix
-   `docs:`: Documentation updates
-   `refactor:`: Code changes that neither fix bugs nor add features

## 🚀 Pull Request Process
1.  Ensure all checks pass (Linting, Types, Tests).
2.  Provide a clear description of the problem and your solution.
3.  Include screenshots for UI changes.
4.  Request a review from the maintainers.

---
© 2026 DevPilot Automation Platform
