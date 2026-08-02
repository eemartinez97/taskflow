/**
 * Sentinel <option> value in OrgSwitcher's <select> that triggers the
 * create-organization flow instead of switching to an actual org.
 *
 * Extracted to its own module (not inlined in org-switcher.tsx) so E2E tests
 * can import this single constant instead of duplicating the literal string -
 * matching Playwright's `selectOption()` by value is far more robust than
 * matching the visible label text (which contains a "＋" glyph and an
 * ellipsis that would make the test brittle against copy changes).
 */
export const CREATE_ORG_VALUE = "__create_org__";
