// Browser globals for component tests, registered as a side effect.
//
// Import this *first* in any test that renders React — ESM executes imports in
// declaration order, so putting it above the React imports is what guarantees
// `document` and `localStorage` exist before React Testing Library or
// `lib/local/store` are evaluated. Node runs each test file in its own process,
// so the globals cannot leak between files.

import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({ url: "https://localhost/app" });

// React only allows `act` to drive updates when it is told it is in a test.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
