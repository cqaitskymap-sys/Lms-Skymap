import assert from "node:assert/strict";
import test from "node:test";
import {
  fixedReadingSeconds,
  parseReadingMinutes,
  reconcileViewedPages,
  resolveReadingSeconds,
} from "./reading";

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

test("the SOP author can set the reading time in minutes", () => {
  assert.equal(parseReadingMinutes(""), undefined);
  assert.equal(parseReadingMinutes("10"), 10);
  assert.equal(fixedReadingSeconds(10), 600);
  assert.equal(resolveReadingSeconds(10, 40, true), 600);
  assert.equal(resolveReadingSeconds(undefined, 40, true), 0);
  assert.equal(resolveReadingSeconds(undefined, 0, false), 120);
  assert.throws(() => parseReadingMinutes("0"));
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
