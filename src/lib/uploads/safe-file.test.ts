import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAllowedUpload,
  isControlledDocument,
  isTrainingEvidence,
  sanitizeStorageFileName,
} from "./safe-file";

function file(name: string, type: string, size = 100): File {
  return new File([new Uint8Array(size)], name, { type });
}

test("storage names drop path segments and unsafe characters", () => {
  assert.equal(sanitizeStorageFileName("..\\..\\evil name.pdf"), "evil_name.pdf");
  assert.equal(sanitizeStorageFileName(""), "file");
});

test("blocked extensions are rejected", () => {
  assert.throws(
    () =>
      assertAllowedUpload(file("payload.html", "text/html"), {
        maxBytes: 1024,
        label: "SOP file",
        accept: isTrainingEvidence,
      }),
    /not allowed/
  );
});

test("pdf and raster evidence are accepted within the size cap", () => {
  assert.equal(isControlledDocument(file("sop.pdf", "application/pdf")), true);
  assert.equal(isTrainingEvidence(file("photo.png", "image/png")), true);
  assert.doesNotThrow(() =>
    assertAllowedUpload(file("sop.pdf", "application/pdf", 50), {
      maxBytes: 1024,
      label: "SOP file",
      accept: isControlledDocument,
    })
  );
});

test("oversized files are rejected", () => {
  assert.throws(
    () =>
      assertAllowedUpload(file("sop.pdf", "application/pdf", 5000), {
        maxBytes: 1024,
        label: "SOP file",
        accept: isControlledDocument,
      }),
    /MB or smaller/
  );
});
