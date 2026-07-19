import { describe, it, expect, beforeEach } from "vitest";
import { MockEtzhayyim } from "@etzhayyim/sdk-mock";
import {
  proposeGame,
  getGameSpec,
  generateGame,
  publishGame,
  playtestGame,
} from "../src/index.js";

describe("gameka kotoba", () => {
  let e: any;

  beforeEach(() => {
    e = new MockEtzhayyim({ did: "did:web:gameka.etzhayyim.com" });
  });

  describe("proposeGame + validation", () => {
    it("proposes game with valid brief", async () => {
      const result = await proposeGame(e, {
        brief: "A puzzle game about sorting colors",
      });

      expect(result.status).toBe("registered");
      expect(result.specId).toBeDefined();
      expect(result.uri).toBeDefined();
    });

    it("rejects proposal with missing brief", async () => {
      const result = await proposeGame(e, { brief: "" });

      expect(result.status).toBe("rejected");
      expect(result.error).toBe("missingBrief");
    });

    it("rejects proposal with brief exceeding 2000 chars", async () => {
      const longBrief = "a".repeat(2001);
      const result = await proposeGame(e, { brief: longBrief });

      expect(result.status).toBe("rejected");
      expect(result.error).toBe("briefTooLong");
    });
  });

  describe("generateGame requires existing GameSpec", () => {
    it("rejects generate without existing spec", async () => {
      const result = await generateGame(e, {
        specId: "nonexistent-spec",
      });

      expect(result.status).toBe("rejected");
      expect(result.error).toBe("specNotFound");
    });

    it("generates artifact when spec exists", async () => {
      const proposal = await proposeGame(e, {
        brief: "Action RPG",
      });

      const result = await generateGame(e, {
        specId: proposal.specId!,
      });

      expect(result.status).toBe("registered");
      expect(result.artifactId).toBeDefined();
      expect(result.wasmCid).toBeDefined();
    });
  });

  describe("publishGame mints sub-DID with game:{slug}", () => {
    it("publishGame creates sub-DID with game: prefix", async () => {
      const proposal = await proposeGame(e, {
        brief: "Tower Defense Game",
      });

      const artifact = await generateGame(e, {
        specId: proposal.specId!,
      });

      const publish = await publishGame(e, {
        specId: proposal.specId!,
        artifactId: artifact.artifactId!,
      });

      expect(publish.status).toBe("registered");
      expect(publish.subDid).toBeDefined();
      expect(publish.subDid).toContain(":game:");
    });

    it("publishGame rejects without artifact", async () => {
      const proposal = await proposeGame(e, {
        brief: "Invalid publish test",
      });

      const result = await publishGame(e, {
        specId: proposal.specId!,
        artifactId: "nonexistent-artifact",
      });

      expect(result.status).toBe("rejected");
      expect(result.error).toBe("artifactNotFound");
    });

    it("publishGame returns playUrl and slug", async () => {
      const proposal = await proposeGame(e, {
        brief: "Card Game",
      });

      const artifact = await generateGame(e, {
        specId: proposal.specId!,
      });

      const publish = await publishGame(e, {
        specId: proposal.specId!,
        artifactId: artifact.artifactId!,
      });

      expect(publish.slug).toBeDefined();
      expect(publish.playUrl).toContain(publish.slug);
      expect(publish.playUrl).toContain("game-play.etzhayyim.com");
    });
  });

  describe("playtestGame requires spec", () => {
    it("playtestGame rejects without spec", async () => {
      const result = await playtestGame(e, {
        specId: "nonexistent",
      });

      expect(result.status).toBe("rejected");
      expect(result.error).toBe("specNotFound");
    });

    it("playtestGame creates QA record when spec exists", async () => {
      const proposal = await proposeGame(e, {
        brief: "Playtest Game",
      });

      const result = await playtestGame(e, {
        specId: proposal.specId!,
        iteration: 1,
      });

      expect(result.status).toBe("registered");
      expect(result.qaId).toBeDefined();
    });
  });
});
