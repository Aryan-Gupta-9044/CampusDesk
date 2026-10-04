let mockStorage;
jest.mock("./supabaseClient", () => ({
  get supabase() {
    return mockStorage;
  },
}));

const { safeFileName, uploadDocument, uploadAvatar, deleteDocument, listMyDocuments } = require("./storage");

const file = (name, size = 1000, type = "application/pdf") => ({ name, size, type });

function makeStorage({ uploadError = null, removeResult = { data: [{ name: "x" }], error: null }, list = [] } = {}) {
  const calls = { uploads: [], removes: [] };
  const bucket = () => ({
    upload: async (path) => {
      calls.uploads.push(path);
      return { error: uploadError };
    },
    list: async () => ({ data: list, error: null }),
    remove: async (paths) => {
      calls.removes.push(paths);
      return removeResult;
    },
    getPublicUrl: (p) => ({ data: { publicUrl: `https://x/${p}` } }),
    createSignedUrl: async () => ({ data: { signedUrl: "https://signed" }, error: null }),
  });
  mockStorage = {
    storage: { from: bucket },
    from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
  };
  return calls;
}

describe("safeFileName", () => {
  test("keeps normal names, strips characters storage rejects", () => {
    expect(safeFileName("Report Card.pdf")).toBe("Report Card.pdf");
    expect(safeFileName("résumé [final] #1 (v2).pdf")).toBe("resume -final- -1 -v2-.pdf");
    expect(safeFileName("a__b.pdf")).toBe("a_b.pdf");
    expect(safeFileName("")).toBe("file");
    expect(safeFileName("..")).toBe("file");
  });
});

describe("uploadDocument", () => {
  test("builds <user>/<Category>__<timestamp>-<safe name> and parses back", async () => {
    const calls = makeStorage();
    const path = await uploadDocument("u1", file("My [ID].pdf"), "ID Proof");
    expect(calls.uploads[0]).toBe(path);
    expect(path).toMatch(/^u1\/ID Proof__\d+-My -ID-\.pdf$/);

    makeStorage({ list: [{ name: path.split("/")[1], metadata: { size: 2048 } }] });
    const [doc] = await listMyDocuments("u1");
    expect(doc).toMatchObject({ category: "ID Proof", displayName: "My -ID-.pdf", path });
  });

  test.each([
    [file("big.pdf", 11 * 1024 * 1024), /10 MB or smaller/],
    [file("empty.pdf", 0), /empty/],
    [file("virus.exe", 100, "application/x-msdownload"), /type isn't allowed/],
  ])("rejects bad file %#", async (f, msg) => {
    const calls = makeStorage();
    await expect(uploadDocument("u1", f, "Other")).rejects.toThrow(msg);
    expect(calls.uploads).toHaveLength(0);
  });

  test("missing bucket gives an actionable message", async () => {
    makeStorage({ uploadError: { message: "Bucket not found" } });
    await expect(uploadDocument("u1", file("a.pdf"), "Other")).rejects.toThrow(/storage_setup\.sql/);
  });

  test("policy failure gives a permission message", async () => {
    makeStorage({ uploadError: { message: "new row violates row-level security policy" } });
    await expect(uploadDocument("u1", file("a.pdf"), "Other")).rejects.toThrow(/permission/);
  });
});

describe("uploadAvatar", () => {
  test("accepts images, rejects big or non-image files", async () => {
    makeStorage();
    await expect(uploadAvatar("u1", file("me.png", 1000, "image/png"))).resolves.toMatch(/^https:\/\/x\/u1\/avatar\.png\?t=\d+$/);
    await expect(uploadAvatar("u1", file("me.png", 3 * 1024 * 1024, "image/png"))).rejects.toThrow(/2 MB or smaller/);
    await expect(uploadAvatar("u1", file("me.pdf", 100, "application/pdf"))).rejects.toThrow(/type isn't allowed/);
  });
});

describe("deleteDocument", () => {
  test("succeeds when the file was removed", async () => {
    const calls = makeStorage();
    await deleteDocument("u1/a.pdf");
    expect(calls.removes[0]).toEqual(["u1/a.pdf"]);
  });

  test("an empty result (hidden by policy) is reported, not silently ignored", async () => {
    makeStorage({ removeResult: { data: [], error: null } });
    await expect(deleteDocument("u1/a.pdf")).rejects.toThrow(/could not be deleted/);
  });
});
