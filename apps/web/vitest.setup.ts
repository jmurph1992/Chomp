// Extends `expect` with jest-dom matchers (toBeInTheDocument, etc) for every
// test file — safe to load globally even for node-environment tests, since
// it only adds matchers and touches no DOM globals itself.
import '@testing-library/jest-dom/vitest'
