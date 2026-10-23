import assert from "node:assert/strict";
import test from "node:test";
import { reconcileViewedPages } from "./reading";

test("a replaced PDF does not keep the old all-pages flag", () => {
  const viewed = reconcileViewedPages({
    pageCount: 5,
    pagesSeen: [1, 2, 3],
    reachedLastPage: true,
    flaggedViewed: true,
  });
  assert.deepEqual(viewed.pagesSeen, [1, 2, 3]);
  assert.equal(viewed.allPagesViewed, false);
});

test("page numbers past the new document are dropped", () => {
  const viewed = reconcileViewedPages({
    pageCount: 2,
    pagesSeen: [1, 2, 9],
    reachedLastPage: true,
    flaggedViewed: false,
  });
  assert.deepEqual(viewed.pagesSeen, [1, 2]);
  assert.equal(viewed.allPagesViewed, true);
});

test("a document without pages can stay marked viewed", () => {
  const viewed = reconcileViewedPages({
    pageCount: 0,
    pagesSeen: [],
    reachedLastPage: false,
    flaggedViewed: true,
  });
  assert.equal(viewed.allPagesViewed, true);
});
