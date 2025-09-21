# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [3.2.0](https://github.com/MapColonies/job-tracker/compare/v3.1.1...v3.2.0) (2025-09-21)


### Features

* add multiple handlers and edit base handler ([8635623](https://github.com/MapColonies/job-tracker/commit/8635623387047f692937db924c0d0ca4e6b64195))
* apply factory ([31d9b4c](https://github.com/MapColonies/job-tracker/commit/31d9b4c1fc93c1cec1bc24f3deebea16abb3b0dd))


### Bug Fixes

* add missing task job parameters ([80c5888](https://github.com/MapColonies/job-tracker/commit/80c58889e4a024290fb1ac5c09cadb08f9dd9646))
* baseHandler behaviour ([9ea7785](https://github.com/MapColonies/job-tracker/commit/9ea7785dd18f83f387377e6bc8bb9f28d7550928))
* fix controller error handling ([849df96](https://github.com/MapColonies/job-tracker/commit/849df96ea5c19a8d2b6c60b1c93b89144a008d2a))
* fix update precentage flow ([10a1ada](https://github.com/MapColonies/job-tracker/commit/10a1ada1df51cec879dcc27d9dd7cfd621c49b75))
* job update when export fails ([442202d](https://github.com/MapColonies/job-tracker/commit/442202d705bc181e3de79ce79dc69f48931900c7))
* small bug fixes ([55c5ab3](https://github.com/MapColonies/job-tracker/commit/55c5ab3ea5b4f63784bd16ecf124d93ca8324692))
* streamline error handling in task notification processing ([b20aaa1](https://github.com/MapColonies/job-tracker/commit/b20aaa11ce31db3cb69a5987e21e7ee53f44fccb))
* vit pr commets ([b9240f2](https://github.com/MapColonies/job-tracker/commit/b9240f2b341057a98b5b530c42d4c1dcc65adcf3))

### [3.1.1](https://github.com-personal/MapColonies/job-tracker/compare/v3.1.0...v3.1.1) (2025-06-23)


### Bug Fixes

* format ([e4183e9](https://github.com-personal/MapColonies/job-tracker/commit/e4183e9719f671135f2b62715e92772e0b36621b))
* unnessesary if ([612cefa](https://github.com-personal/MapColonies/job-tracker/commit/612cefa8f76859ce8c7c75362a66047177766d64))

## [3.1.0](https://github.com-personal/MapColonies/job-tracker/compare/v3.0.0...v3.1.0) (2025-06-22)


### Features

* support tiles Seeding job and tasks ([ddc3e51](https://github.com-personal/MapColonies/job-tracker/commit/ddc3e51d48d3506326e2fbab78a0ddb4679eba95))


### Bug Fixes

* lint ([ac57ace](https://github.com-personal/MapColonies/job-tracker/commit/ac57ace275ef650775f2be075fcf574c55cc69e5))
* lint error ([ed2752c](https://github.com-personal/MapColonies/job-tracker/commit/ed2752c3360a21ff796c7c8a5bfc1b4b035e572e))
* pr changes ([fa51d2c](https://github.com-personal/MapColonies/job-tracker/commit/fa51d2ceb5792c280c04eff1d4b01d25410b4369))
* pr changes ([2ab0665](https://github.com-personal/MapColonies/job-tracker/commit/2ab0665035d2b4869ee3d956421b2ff96ca37f59))

## [3.0.0](https://github.com/MapColonies/job-tracker/compare/v2.0.0...v3.0.0) (2025-05-18)


### ⚠ BREAKING CHANGES

* removed 'failed' export finalize task and support one finalize … (#20)

### Features

* removed 'failed' export finalize task and support one finalize … ([#20](https://github.com/MapColonies/job-tracker/issues/20)) ([5c47346](https://github.com/MapColonies/job-tracker/commit/5c47346e833fcfaf3724c71f5504dede0174c563))

## [2.0.0](https://github.com/MapColonies/job-tracker/compare/v1.5.4...v2.0.0) (2025-05-12)


### ⚠ BREAKING CHANGES

* remove polygonParts process  (MAPCO-7575) (#19)

### Features

* remove polygonParts process  (MAPCO-7575) ([#19](https://github.com/MapColonies/job-tracker/issues/19)) ([e6f2fab](https://github.com/MapColonies/job-tracker/commit/e6f2fabf0058be2224183d1a11b60cceb6c2b880))

### [1.5.4](https://github.com/MapColonies/job-tracker/compare/v1.5.3...v1.5.4) (2025-04-02)


### Bug Fixes

* improve task handling logic and add tests for polygon-parts task creation ([f32b1a5](https://github.com/MapColonies/job-tracker/commit/f32b1a5ae6cc04fb2214754d93f6c6673947be3a))

### [1.5.3](https://github.com/MapColonies/job-tracker/compare/v1.5.2...v1.5.3) (2025-04-02)


### Bug Fixes

* include percentage in job completion status update ([a32a052](https://github.com/MapColonies/job-tracker/commit/a32a052889d2b61024984624f975ee63b9b9ed43))

### [1.5.2](https://github.com/MapColonies/job-tracker/compare/v1.5.1...v1.5.2) (2025-03-30)


### Bug Fixes

* ensure job fails on export finalize task failure ([f877186](https://github.com/MapColonies/job-tracker/commit/f87718681ab3922f899c2709d56c657f850992fb))
* for failed export finalize task, fail the job ([7659622](https://github.com/MapColonies/job-tracker/commit/7659622626983917a2e1b172024b356811de05dd))

### [1.5.1](https://github.com/MapColonies/job-tracker/compare/v1.5.0...v1.5.1) (2025-03-26)


### Bug Fixes

* lint errors ([978f8f9](https://github.com/MapColonies/job-tracker/commit/978f8f96647de28b2412d9fa9b2fffcc1519197a))
* remove this from logger instance ([6ad3013](https://github.com/MapColonies/job-tracker/commit/6ad3013d233061d9ceecd7e928c7812d7b107748))
* update @map-colonies/raster-shared to version 1.9.0 and improve job completion handling (handle complete finalize tasks) ([6b7a91c](https://github.com/MapColonies/job-tracker/commit/6b7a91c3e5fd2e15cf6f06031091c4804bf736be))
* update @map-colonies/raster-shared to version 1.9.0 and improve job completion handling (handle complete finalize tasks) ([b40f750](https://github.com/MapColonies/job-tracker/commit/b40f750c69b4396ca1e95b2605016e0365b9bd16))

## [1.5.0](https://github.com/MapColonies/job-tracker/compare/v1.4.1...v1.5.0) (2025-03-16)


### Features

* handle finalization on export job ([6d15929](https://github.com/MapColonies/job-tracker/commit/6d15929003b7378957c48e0f04bf821a35a9a68d))


### Bug Fixes

* added logs and allow duplication on export finalize ([df76c1f](https://github.com/MapColonies/job-tracker/commit/df76c1f8ab9c10502cb2ebf6cfa499e78900a299))
* git ignore ([7687384](https://github.com/MapColonies/job-tracker/commit/76873840cfad0e98d7d864809ce206e27383f0a1))

### [1.4.1](https://github.com/MapColonies/job-tracker/compare/v1.4.0...v1.4.1) (2025-02-24)


### Bug Fixes

* removing max_old_space_size from Dockerfile ([45fe0c4](https://github.com/MapColonies/job-tracker/commit/45fe0c466e2f7764efa60f7f1ca2c3a067a2596a))

## [1.4.0](https://github.com/MapColonies/job-tracker/compare/v1.3.1...v1.4.0) (2025-01-09)


### Features

* add export job support ([e6517bb](https://github.com/MapColonies/job-tracker/commit/e6517bb10b55c09381bc04c0325531fae6280102))
* add export job support (MAPCO-5962) ([#12](https://github.com/MapColonies/job-tracker/issues/12)) ([0ecbe55](https://github.com/MapColonies/job-tracker/commit/0ecbe55374ea5b620308b5be3fffae71e4881165))

### [1.3.1](https://github.com/MapColonies/job-tracker/compare/v1.3.0...v1.3.1) (2024-12-15)


### Bug Fixes

* duplicate tasks ([a15048f](https://github.com/MapColonies/job-tracker/commit/a15048f0df80fa7da72d57614944ccc21c02b72e))

## [1.3.0](https://github.com/MapColonies/job-tracker/compare/v1.2.2...v1.3.0) (2024-12-05)


### Features

* make polygon parts fail suspend the job (MAPCO-5528) ([#9](https://github.com/MapColonies/job-tracker/issues/9)) ([e27eade](https://github.com/MapColonies/job-tracker/commit/e27eade0e3abd7b074162d446b91db32f740edb5))

### [1.2.2](https://github.com/MapColonies/job-tracker/compare/v1.2.0...v1.2.2) (2024-11-17)


### Bug Fixes

* change port value to 80 ([5e6515b](https://github.com/MapColonies/job-tracker/commit/5e6515b922080ea124b1323c3efc7e56df933c10))
* changed environment variable names and added new vars in configmap ([#7](https://github.com/MapColonies/job-tracker/issues/7)) ([03e5d04](https://github.com/MapColonies/job-tracker/commit/03e5d043e851c91a79a5e611c7efce41da91e06c))

### [1.2.1](https://github.com/MapColonies/job-tracker/compare/v1.2.0...v1.2.1) (2024-11-17)


### Bug Fixes

* change port value to 80 ([5e6515b](https://github.com/MapColonies/job-tracker/commit/5e6515b922080ea124b1323c3efc7e56df933c10))
* changed environment variable names and added new vars in configmap ([#7](https://github.com/MapColonies/job-tracker/issues/7)) ([03e5d04](https://github.com/MapColonies/job-tracker/commit/03e5d043e851c91a79a5e611c7efce41da91e06c))

## [1.2.0](https://github.com/MapColonies/job-tracker/compare/v1.1.0...v1.2.0) (2024-11-03)


### Features

* added parameters for different finalize tasks ([#5](https://github.com/MapColonies/job-tracker/issues/5)) ([806611e](https://github.com/MapColonies/job-tracker/commit/806611e2d97cc654083f6df72f3f24d004f84104))

## 1.1.0 (2024-10-14)


### Features

* added actual notify endpoint to jobs router ([7d4f60d](https://github.com/MapColonies/job-tracker/commit/7d4f60d972ba60dca264738165b185c8eaa690a3))
* added notify route functionality (MAPCO-4709) ([#2](https://github.com/MapColonies/job-tracker/issues/2)) ([bc09b3e](https://github.com/MapColonies/job-tracker/commit/bc09b3e5eef4286c854a4f93d4ec2576adcf7eac))


### Bug Fixes

* added placeholder comment to test to avoid lint error ([638369f](https://github.com/MapColonies/job-tracker/commit/638369f939abd5e5ff471a8f261c0359c8c56be8))
* changed 'Job' reference to 'Task' ([77553da](https://github.com/MapColonies/job-tracker/commit/77553dae77bdbc9ecf4a2bb1be1672ac796e73ed))
* corrected TaskNotificationHandler name ([6efaf39](https://github.com/MapColonies/job-tracker/commit/6efaf39503b38c010278ed8bb556b050da37de61))
* handleTaskNotification correct implementation ([1e640dc](https://github.com/MapColonies/job-tracker/commit/1e640dc74f665a9ac97fe7fe0b38176aef32f3aa))
* lint ([ef18077](https://github.com/MapColonies/job-tracker/commit/ef18077e710f8a77fd1b060eff7838caf9ec538b))
* lint CamelCase on TasksController ([54244d6](https://github.com/MapColonies/job-tracker/commit/54244d622337add35485b5ac468571bac745ce5e))
