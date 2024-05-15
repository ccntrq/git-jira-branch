# Changelog

All notable changes to this project since `git-jira-branch v1.0.0` will be
documented in this file. The changelog of the project before the rename from
`git-create-jira-branch` to `git-jira-branch` can be found in the old
[CHANGELOG_OLD.md](./CHANGELOG_OLD.md).

This project adheres to [Semantic
Versioning](https://semver.org/spec/v2.0.0.html). For commit guidelines see
[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

## [2.0.2](https://github.com/ccntrq/git-jira-branch/compare/git-jira-branch-v2.0.1...git-jira-branch-v2.0.2) (2024-05-13)


### Bug Fixes

* **deps:** bump the production-dependencies group with 7 updates ([#328](https://github.com/ccntrq/git-jira-branch/issues/328)) ([89fb4c3](https://github.com/ccntrq/git-jira-branch/commit/89fb4c36cb3802bd0c21684fde3ad6fe636107a5))

## [2.0.1](https://github.com/ccntrq/git-jira-branch/compare/git-jira-branch-v2.0.0...git-jira-branch-v2.0.1) (2024-05-09)


### Bug Fixes

* **deps:** bump the production-dependencies group with 7 updates ([#325](https://github.com/ccntrq/git-jira-branch/issues/325)) ([238fa00](https://github.com/ccntrq/git-jira-branch/commit/238fa0025c15964b72d82291f0f54714b8d15e6c))

## [2.0.0](https://github.com/ccntrq/git-jira-branch/compare/git-jira-branch-v1.4.3...git-jira-branch-v2.0.0) (2024-05-08)


### ⚠ BREAKING CHANGES

* The create command was previously responsible for creating and switching branches. To prevent accidentally switching to an existing branch or accidentally creating a new one when switching was intended the new `switch` command was added in v1.4. This command should be used from now on. `create` will only create new branches and fail if a brach associated with the given ticket already exists (unless `--reset` is given)

### Features

* prevent create command from switching branches ([#316](https://github.com/ccntrq/git-jira-branch/issues/316)) ([16b0267](https://github.com/ccntrq/git-jira-branch/commit/16b0267ed3806b0bb6f89fd3ba95cfd2ded9e099))


### Bug Fixes

* **deps:** bump the production-dependencies group across 1 directory with 7 updates ([#312](https://github.com/ccntrq/git-jira-branch/issues/312)) ([35c6d6b](https://github.com/ccntrq/git-jira-branch/commit/35c6d6beae0203d819931ee06fd50f76c40e7ab0))
* **deps:** bump the production-dependencies group with 3 updates ([#319](https://github.com/ccntrq/git-jira-branch/issues/319)) ([17b8769](https://github.com/ccntrq/git-jira-branch/commit/17b8769023ad85107c18e0721618caa3d1a85063))
* **deps:** bump the production-dependencies group with 3 updates ([#321](https://github.com/ccntrq/git-jira-branch/issues/321)) ([dc411bc](https://github.com/ccntrq/git-jira-branch/commit/dc411bc4d111a4e40493a690e5b0d119c4883e27))
* **deps:** bump the production-dependencies group with 4 updates ([#323](https://github.com/ccntrq/git-jira-branch/issues/323)) ([d38bfd6](https://github.com/ccntrq/git-jira-branch/commit/d38bfd63d5ed99249796d120e68d44d65d43a5e8))
* **deps:** bump the production-dependencies group with 7 updates ([#314](https://github.com/ccntrq/git-jira-branch/issues/314)) ([8722c5b](https://github.com/ccntrq/git-jira-branch/commit/8722c5bb2bb3bdbc95021e70c2a3a7e2a89f3b19))
* **deps:** bump the production-dependencies group with 7 updates ([#317](https://github.com/ccntrq/git-jira-branch/issues/317)) ([ae0f70e](https://github.com/ccntrq/git-jira-branch/commit/ae0f70e4641d9c95b8cf4fb1034a0c019e2715e5))

## [1.4.3](https://github.com/ccntrq/git-jira-branch/compare/git-jira-branch-v1.4.2...git-jira-branch-v1.4.3) (2024-04-29)


### Bug Fixes

* **deps:** bump the production-dependencies group with 7 updates ([#306](https://github.com/ccntrq/git-jira-branch/issues/306)) ([71ab2f9](https://github.com/ccntrq/git-jira-branch/commit/71ab2f9c69e068e591a4f008f6fcf0945576d1f0))

## [1.4.2](https://github.com/ccntrq/git-jira-branch/compare/git-jira-branch-v1.4.1...git-jira-branch-v1.4.2) (2024-04-27)


### Bug Fixes

* **deps:** bump the production-dependencies group with 7 updates ([#299](https://github.com/ccntrq/git-jira-branch/issues/299)) ([2fbb6e9](https://github.com/ccntrq/git-jira-branch/commit/2fbb6e983c900e7006046efd55bbfda171bfdc72))
* **deps:** bump the production-dependencies group with 7 updates ([#303](https://github.com/ccntrq/git-jira-branch/issues/303)) ([055a0c4](https://github.com/ccntrq/git-jira-branch/commit/055a0c4ed2da1fa381de27865262175c03ae5a5d))

## [1.4.1](https://github.com/ccntrq/git-jira-branch/compare/git-jira-branch-v1.4.0...git-jira-branch-v1.4.1) (2024-04-22)


### Bug Fixes

* **deps:** bump the production-dependencies group with 4 updates ([#297](https://github.com/ccntrq/git-jira-branch/issues/297)) ([2cce4a6](https://github.com/ccntrq/git-jira-branch/commit/2cce4a645ffc64ba5ce15906f05ea613751dbae8))
* **deps:** bump the production-dependencies group with 7 updates ([#291](https://github.com/ccntrq/git-jira-branch/issues/291)) ([341474e](https://github.com/ccntrq/git-jira-branch/commit/341474ece603910bbc4572c460318542838a1c52))
* **deps:** bump the production-dependencies group with 7 updates ([#295](https://github.com/ccntrq/git-jira-branch/issues/295)) ([dd09772](https://github.com/ccntrq/git-jira-branch/commit/dd0977241a03ee22c9125f7323f6a27e4a767e22))

## [1.4.0](https://github.com/ccntrq/git-jira-branch/compare/git-jira-branch-v1.3.3...git-jira-branch-v1.4.0) (2024-04-16)


### Features

* add switch command to switch to already existing branches ([#275](https://github.com/ccntrq/git-jira-branch/issues/275)) ([b7f356f](https://github.com/ccntrq/git-jira-branch/commit/b7f356fc8a7823425765d33d6f5086e619dc688e))
* update to effect v3.0.0 🎉 ([#289](https://github.com/ccntrq/git-jira-branch/issues/289)) ([0271755](https://github.com/ccntrq/git-jira-branch/commit/02717550ab6d446cf8b55687b8433f5f7fd4a34f))

## [1.3.3](https://github.com/ccntrq/git-jira-branch/compare/git-jira-branch-v1.3.2...git-jira-branch-v1.3.3) (2024-04-08)


### Bug Fixes

* **deps:** bump the production-dependencies group with 4 updates ([#276](https://github.com/ccntrq/git-jira-branch/issues/276)) ([af7bb28](https://github.com/ccntrq/git-jira-branch/commit/af7bb28adde0f607af55857f84cc56c631cfed12))

## [1.3.2](https://github.com/ccntrq/git-jira-branch/compare/git-jira-branch-v1.3.1...git-jira-branch-v1.3.2) (2024-04-05)


### Bug Fixes

* add info about switching to existing branches to create command ([#272](https://github.com/ccntrq/git-jira-branch/issues/272)) ([382acfd](https://github.com/ccntrq/git-jira-branch/commit/382acfd39ace74221f082a482d0122d27e28d08b))
* **deps:** bump the production-dependencies group with 7 updates ([#273](https://github.com/ccntrq/git-jira-branch/issues/273)) ([9e78a7c](https://github.com/ccntrq/git-jira-branch/commit/9e78a7c29d518ff6980ed44f89a1893584c965d4))
* **deps:** bump undici from 6.10.1 to 6.11.1 ([#270](https://github.com/ccntrq/git-jira-branch/issues/270)) ([7ed228d](https://github.com/ccntrq/git-jira-branch/commit/7ed228d3be7e7d61154aeaf008e60259c2179c38))

## [1.3.1](https://github.com/ccntrq/git-jira-branch/compare/git-jira-branch-v1.3.0...git-jira-branch-v1.3.1) (2024-04-04)


### Bug Fixes

* **deps:** bump the production-dependencies group with 7 updates ([#265](https://github.com/ccntrq/git-jira-branch/issues/265)) ([cb55c75](https://github.com/ccntrq/git-jira-branch/commit/cb55c754cd45f86767b3a986294813324a34e4d8))

## [1.3.0](https://github.com/ccntrq/git-jira-branch/compare/git-jira-branch-v1.2.0...git-jira-branch-v1.3.0) (2024-04-02)


### Features

* base existing branch matches only on their jira key ([#262](https://github.com/ccntrq/git-jira-branch/issues/262)) ([4a65cc6](https://github.com/ccntrq/git-jira-branch/commit/4a65cc661a394ddb5dc6c92b8ce2f6efae480d0d))

## [1.2.0](https://github.com/ccntrq/git-jira-branch/compare/git-jira-branch-v1.1.3...git-jira-branch-v1.2.0) (2024-04-01)


### Features

* new `list` command shows branches possibly associated with a jira ticket ([#243](https://github.com/ccntrq/git-jira-branch/issues/243)) ([a8eb9ce](https://github.com/ccntrq/git-jira-branch/commit/a8eb9ce8f98b01ca04e5443e82d0176e5953fe80))
* reflow text to 80 chars in info output ([#258](https://github.com/ccntrq/git-jira-branch/issues/258)) ([d65a640](https://github.com/ccntrq/git-jira-branch/commit/d65a64030d447921ff5b1a56a50e0b961dd966e3))
* set nonzero exitcode on failures ([#254](https://github.com/ccntrq/git-jira-branch/issues/254)) ([0a2a085](https://github.com/ccntrq/git-jira-branch/commit/0a2a08578c67a350d2c249fed8592e8934e8abea))


### Bug Fixes

* **deps:** bump the production-dependencies group with 4 updates ([#256](https://github.com/ccntrq/git-jira-branch/issues/256)) ([3ca8c47](https://github.com/ccntrq/git-jira-branch/commit/3ca8c479e474bad472066f7ea81ccd392a745dd0))

## [1.1.3](https://github.com/ccntrq/git-jira-branch/compare/git-jira-branch-v1.1.2...git-jira-branch-v1.1.3) (2024-03-31)


### Bug Fixes

* **deps:** bump the production-dependencies group with 7 updates ([#250](https://github.com/ccntrq/git-jira-branch/issues/250)) ([8e816aa](https://github.com/ccntrq/git-jira-branch/commit/8e816aaa591e74afa1e8a9522ffb8d527a91ecec))

## [1.1.2](https://github.com/ccntrq/git-jira-branch/compare/git-jira-branch-v1.1.1...git-jira-branch-v1.1.2) (2024-03-27)


### Bug Fixes

* **deps:** bump the production-dependencies group with 7 updates ([#244](https://github.com/ccntrq/git-jira-branch/issues/244)) ([d7a0833](https://github.com/ccntrq/git-jira-branch/commit/d7a083379ffa2b9c707f42a11fc49e8e20863770))
* **deps:** bump the production-dependencies group with 7 updates ([#247](https://github.com/ccntrq/git-jira-branch/issues/247)) ([be02c49](https://github.com/ccntrq/git-jira-branch/commit/be02c4920dc5148a06c436cb546660a2634b0ee4))

## [1.1.1](https://github.com/ccntrq/git-jira-branch/compare/git-jira-branch-v1.1.0...git-jira-branch-v1.1.1) (2024-03-22)


### Bug Fixes

* **deps:** bump the production-dependencies group with 7 updates ([#238](https://github.com/ccntrq/git-jira-branch/issues/238)) ([e8eecbe](https://github.com/ccntrq/git-jira-branch/commit/e8eecbed6e096fb05f161ad8324ffbc626b1749d))
* improved jira key extraction from branch name ([#242](https://github.com/ccntrq/git-jira-branch/issues/242)) ([11aaab3](https://github.com/ccntrq/git-jira-branch/commit/11aaab378586f35b6ab72b586f9e283a3904d2d3))

## [1.1.0](https://github.com/ccntrq/git-jira-branch/compare/git-jira-branch-v1.0.4...git-jira-branch-v1.1.0) (2024-03-21)


### Features

* add info subcommand to display details for a ticket ([#218](https://github.com/ccntrq/git-jira-branch/issues/218)) ([88317b0](https://github.com/ccntrq/git-jira-branch/commit/88317b0d08eece029d255d02b553e090887e8796))


### Bug Fixes

* **deps:** bump the production-dependencies group with 6 updates ([#235](https://github.com/ccntrq/git-jira-branch/issues/235)) ([c72a69a](https://github.com/ccntrq/git-jira-branch/commit/c72a69a248ba5cf529b96e64468ce61c9a658f42))

## [1.0.4](https://github.com/ccntrq/git-jira-branch/compare/git-jira-branch-v1.0.3...git-jira-branch-v1.0.4) (2024-03-20)


### Bug Fixes

* correct the description for the jira-key arg of the open command ([#231](https://github.com/ccntrq/git-jira-branch/issues/231)) ([d46ecda](https://github.com/ccntrq/git-jira-branch/commit/d46ecdab9cf9cfc010b0ba7e09fba9e776003fa9))
* **deps:** bump the production-dependencies group with 4 updates ([#233](https://github.com/ccntrq/git-jira-branch/issues/233)) ([5041ce6](https://github.com/ccntrq/git-jira-branch/commit/5041ce6814bc61b0d9c3d37c4bdad2326b311eb2))

## [1.0.3](https://github.com/ccntrq/git-jira-branch/compare/git-jira-branch-v1.0.2...git-jira-branch-v1.0.3) (2024-03-19)


### Bug Fixes

* **deps:** resolve broken effect package combination ([#227](https://github.com/ccntrq/git-jira-branch/issues/227)) ([3205612](https://github.com/ccntrq/git-jira-branch/commit/3205612b07852910f5bc1725fe7b951a8464ca28))

## [1.0.2](https://github.com/ccntrq/git-jira-branch/compare/git-jira-branch-v1.0.1...git-jira-branch-v1.0.2) (2024-03-17)


### Bug Fixes

* **deps:** bump the production-dependencies group with 5 updates ([#215](https://github.com/ccntrq/git-jira-branch/issues/215)) ([3dee601](https://github.com/ccntrq/git-jira-branch/commit/3dee60115178f36179079d396d1e0207a9964b54))
* **deps:** bump the production-dependencies group with 5 updates ([#222](https://github.com/ccntrq/git-jira-branch/issues/222)) ([9aaf739](https://github.com/ccntrq/git-jira-branch/commit/9aaf7399024e9e3eb4fff5b600314df9a61a2ea3))

## [1.0.1](https://github.com/ccntrq/git-jira-branch/compare/git-jira-branch-v1.0.0...git-jira-branch-v1.0.1) (2024-03-12)


### Bug Fixes

* **deps:** bump the production-dependencies group with 5 updates ([#210](https://github.com/ccntrq/git-jira-branch/issues/210)) ([42a1598](https://github.com/ccntrq/git-jira-branch/commit/42a159879ef0d6b53b53d10601419f167b810880))

## [1.0.0](https://github.com/ccntrq/git-jira-branch/compare/git-jira-branch-v1.0.0...git-jira-branch-v1.0.0) (2024-03-07)


### Features

* rename project to git-jira-branch ([#208](https://github.com/ccntrq/git-jira-branch/issues/208)) ([02de11a](https://github.com/ccntrq/git-jira-branch/commit/02de11a664bdd51d9bf13249dca7af90244eb01d))
