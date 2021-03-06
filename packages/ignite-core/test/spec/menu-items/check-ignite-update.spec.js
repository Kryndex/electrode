"use strict";

const checkIgniteUpdate = require("../../../lib/menu-items/check-ignite-update");
const checkModule = require("../../../lib/util/check-module");
const logger = require("../../../lib/util/logger");
const helpers = require("../../../lib/util/helpers");
const expect = require("chai").expect;
const sinon = require("sinon");
const _ = require("lodash");
const Promise = require("bluebird");
const chalk = require("chalk");
chalk.enabled = false;

describe("menu-item check-ignite-update", function() {
  let logs = [];
  let logStub;
  let spinnerStub;

  before(() => {
    logStub = sinon.stub(logger, "log").callsFake(msg => logs.push(msg));
    spinnerStub = sinon.stub(helpers, "makeSpinner").callsFake(() => {
      return { start: _.noop, stop: _.noop };
    });
  });

  after(() => {
    logStub.restore();
    spinnerStub.restore();
  });

  const makeStubs = (name, globalVersion, latestVersion) => {
    name = name || "electrode-ignite";
    const stubs = {};
    stubs.globalInstalledStub = sinon.stub(checkModule, "globalInstalled").callsFake(n => {
      expect(n).to.equal(name);
      return globalVersion;
    });
    stubs.latestOnceDailyStub = sinon.stub(checkModule, "latestOnceDaily").callsFake(n => {
      expect(n).to.equal(name);
      return latestVersion;
    });
    stubs.latestStub = sinon.stub(checkModule, "latest").callsFake(n => {
      expect(n).to.equal(name);
      return latestVersion;
    });
    stubs.npmInstallStub = sinon.stub(helpers, "npmInstall").returns(Promise.resolve());
    stubs.restore = () => {
      stubs.globalInstalledStub.restore();
      stubs.latestOnceDailyStub.restore();
      stubs.latestStub.restore();
      stubs.npmInstallStub.restore();
    };
    return stubs;
  };

  const makeYesNoStub = yes => {
    const stubs = {};
    stubs.yesNoStub = sinon.stub(helpers, "yesNoPrompt").callsFake(q => {
      stubs.question = q;
      return Promise.resolve(yes);
    });
    stubs.restore = () => stubs.yesNoStub.restore();
    return stubs;
  };

  it("should create menu item", () => {
    const mi = checkIgniteUpdate("test-module");
    expect(mi.emit).to.exist;
    expect(mi.menuText).to.equal(`Check for test-module update`);
    expect(mi.icon).to.exist;
    expect(mi.execute).to.exist;
  });

  it("should prompt user to update if latest is newer", done => {
    const stubs = makeStubs("test-module", "1.0.0", "1.0.1");
    logs = [];
    const mi = checkIgniteUpdate("test-module");
    mi.index = 999;
    mi.emit("post_show", {
      menu: {
        emit: () => {
          stubs.restore();
          expect(logs[0]).includes("Newer version 1.0.1 of test-module found.");
          expect(logs[0]).includes("Pick option 999 to update");
          done();
        }
      }
    });
  });

  it("should do nothing if latest is not newer", done => {
    const stubs = makeStubs("test-module", "1.0.2", "1.0.1");
    let event;
    logs = [];
    const mi = checkIgniteUpdate("test-module");
    mi.emit("post_show", {
      menu: { emit: () => (event = true) }
    });

    setTimeout(() => {
      stubs.restore();
      expect(event).to.equal(undefined);
      expect(logs).to.deep.equal([]);
      done();
    }, 30);
  });

  describe("execute", function() {
    it("should let user know if version is already latest", () => {
      const stubs = makeStubs("test-module", "1.0.1", "1.0.1");
      logs = [];
      const mi = checkIgniteUpdate("test-module");
      return mi
        .execute()
        .then(() => {
          expect(logs[0]).includes("is already the latest");
        })
        .finally(() => {
          stubs.restore();
        });
    });

    it("should prompt user to update if version is older than latest", () => {
      const stubs = makeStubs(undefined, "1.0.0", "1.0.1");
      const yesNoStub = makeYesNoStub(true);
      let event;
      logs = [];
      const mi = checkIgniteUpdate();
      return mi
        .execute({
          menu: {
            emit: evt => (event = evt)
          }
        })
        .then(() => {
          stubs.restore();
          yesNoStub.restore();
          expect(stubs.npmInstallStub.args).to.deep.equal([["electrode-ignite", "1.0.1", true]]);
          expect(yesNoStub.question).to.equal(
            "Update electrode-ignite from version 1.0.0 to 1.0.1"
          );
          expect(event).to.equal("exit");
        });
    });

    it("should not update if user answer no", () => {
      const stubs = makeStubs(undefined, "1.0.0", "1.0.1");
      const yesNoStub = makeYesNoStub(false);
      logs = [];
      const mi = checkIgniteUpdate();
      return mi
        .execute()
        .then(() => {
          expect(logs).to.deep.equal([]);
          expect(yesNoStub.question).to.equal(
            "Update electrode-ignite from version 1.0.0 to 1.0.1"
          );
        })
        .finally(() => {
          stubs.restore();
          yesNoStub.restore();
        });
    });
  });
});
