# Changelog

## [0.7.0](https://github.com/ITM-Kitware/align-browser/compare/v0.6.0...v0.7.0) (2025-07-31)


### Features

* add expandable choice info display to UI ([754f6a0](https://github.com/ITM-Kitware/align-browser/commit/754f6a0550881cd1508b35556dd6f23f015241b8))
* support direct experiment directory paths in CLI ([d5762c1](https://github.com/ITM-Kitware/align-browser/commit/d5762c11f50f35302eb3eaddc808965d061a30e8))

## [0.6.0](https://github.com/ITM-Kitware/align-browser/compare/v0.5.0...v0.6.0) (2025-07-22)


### Features

* add user notification system for manifest version mismatch ([d7705d3](https://github.com/ITM-Kitware/align-browser/commit/d7705d3a746b0ffc8793324ceebc31e4760c7c8f)), closes [#29](https://github.com/ITM-Kitware/align-browser/issues/29)


### Bug Fixes

* improve static asset copying to include all files automatically ([d6dd5a1](https://github.com/ITM-Kitware/align-browser/commit/d6dd5a1b4a04634ef7635c425a134bbcb0ac2118))
* parse personal_safety KDMA names with underscores ([043d99b](https://github.com/ITM-Kitware/align-browser/commit/043d99b7ad2da8f70c21761470305521d0fbf906))
* replace http.server with waitress to eliminate BrokenPipeError ([c859ea6](https://github.com/ITM-Kitware/align-browser/commit/c859ea61c0c92dc98bc6d84b45c4bfb566f35024))

## [0.5.0](https://github.com/ITM-Kitware/align-browser/compare/v0.4.0...v0.5.0) (2025-07-22)


### Features

* add multi-KDMA support for experiment parsing and frontend ([ad7a220](https://github.com/ITM-Kitware/align-browser/commit/ad7a220985b08fbf63bcaff36eebdae5723041b3))
* add URL parameter validation against manifest creation date ([702ae05](https://github.com/ITM-Kitware/align-browser/commit/702ae05ae71d4c3beb35b0dff357df868e06740f))


### Bug Fixes

* correct source index usage for mixed KDMA experiments ([be8ce1d](https://github.com/ITM-Kitware/align-browser/commit/be8ce1db95aa96cfd9f7d8e2ed44027129fe71f3))
* enable KDMA delete buttons when valid combinations exist ([190d073](https://github.com/ITM-Kitware/align-browser/commit/190d0731e9a979eb9a56f2ba6642af1549b03044))
* improve Add KDMA button logic to check valid combinations ([06be9fa](https://github.com/ITM-Kitware/align-browser/commit/06be9fab3305d5228585b1b9a729e33f512f2aba))
* remove pypi environment requirement from release workflow ([e87f724](https://github.com/ITM-Kitware/align-browser/commit/e87f72407072f305bd12602121ddfaaafb2ba204))
* repair run variant dropdown using existing parameter system ([a5e78d6](https://github.com/ITM-Kitware/align-browser/commit/a5e78d6999dc5409d9faa6d49dd6dc46d9762a57))
* resolve URL state initialization issues for pinned runs ([09d5650](https://github.com/ITM-Kitware/align-browser/commit/09d5650bf4bc4a67e05ff76d6cf5c0e9500e45ad))
* restrict KDMA sliders to valid values using HTML5 constraints ([75746d8](https://github.com/ITM-Kitware/align-browser/commit/75746d8b300d380bc26d2d5e9e34add3ab236ce2))
* show only valid KDMA types in dropdown selection ([698abc1](https://github.com/ITM-Kitware/align-browser/commit/698abc1a616162b039b2b6c6d3079ef19a208bfd))

## [0.4.0](https://github.com/PaulHax/align-browser/compare/v0.3.0...v0.4.0) (2025-07-17)


### Features

* make scores.json optional in experiment processing ([c45b0fa](https://github.com/PaulHax/align-browser/commit/c45b0faef796d4afea05177065461b4a95a9e78e))
* support eval files ([37ba5e8](https://github.com/PaulHax/align-browser/commit/37ba5e80595061b04dcb6827c978342e88cf79e2))


### Bug Fixes

* avoid KDMAs in run variants ([3b2bf0b](https://github.com/PaulHax/align-browser/commit/3b2bf0b615e792417b78bb18366aa6387a69ea85))
* avoid run variants messing up chaning ADMs ([17c838f](https://github.com/PaulHax/align-browser/commit/17c838fd4f5444f0e0e1c8b38874f4dff31b708d))
* improve run variant handling and scenario-based filtering ([f081001](https://github.com/PaulHax/align-browser/commit/f08100190b7526753d2f797267128bf23d5000b4))
* run variant dropdown persistence and parameter validation ([1765988](https://github.com/PaulHax/align-browser/commit/176598852f6a297b57f98a2106e7c5dc576ac349))
* validate KDMA configuration after scenario changes ([4c6677c](https://github.com/PaulHax/align-browser/commit/4c6677cc1f53939adc349d90ce304f64abf1cada))

## [0.3.0](https://github.com/PaulHax/align-browser/compare/v0.2.1...v0.3.0) (2025-07-15)


### Features

* add comprehensive CI workflow for lint and tests ([826dedf](https://github.com/PaulHax/align-browser/commit/826dedf037db5979b9e585d252669f387b4679f2))
* add recursive experiment directory parsing with OUTDATED filtering ([0234a2b](https://github.com/PaulHax/align-browser/commit/0234a2bf7bbc6668c424c8ce91b38088553ef563))
* improve UI styling and KDMA labeling ([ca149fc](https://github.com/PaulHax/align-browser/commit/ca149fcff272d09d3eded15b4b7bc0f6d90f3fdf))


### Bug Fixes

* add directory existence check in build.py ([06dba34](https://github.com/PaulHax/align-browser/commit/06dba3493d0fbd7cbb364240b15d83bb9e9fec9c))
* **build:** free the network port faster ([a9f9f8f](https://github.com/PaulHax/align-browser/commit/a9f9f8fdf3902c943a73e968a05442ec1445584f))
* **build:** in dev mode serve from static directory ([d1e69f6](https://github.com/PaulHax/align-browser/commit/d1e69f6ccb6ca9a5ce4024804b3444286f10204a))
* KDMA default value issue for pipeline_baseline multi-KDMA combinations ([9d5e85d](https://github.com/PaulHax/align-browser/commit/9d5e85d409600581bf530811d9b30b42a586a13b))
* KDMA delete button asymmetric behavior and slider race conditions ([d16ff56](https://github.com/PaulHax/align-browser/commit/d16ff56e8bf7979ea6342979434597276eeb2ed9))
* make tests completely deterministic ([e72fff3](https://github.com/PaulHax/align-browser/commit/e72fff34af7d2040adf87e0bc7d95449328aa775))

## [0.2.1](https://github.com/PaulHax/align-browser/compare/v0.2.0...v0.2.1) (2025-07-11)


### Bug Fixes

* remove verbose build output and update docs ([1e50a6d](https://github.com/PaulHax/align-browser/commit/1e50a6dbce67f949ac13eb71591012fbbd3cfd93))

## [0.2.0](https://github.com/PaulHax/align-browser/compare/v0.1.0...v0.2.0) (2025-07-10)


### Features

* improve static asset access for uvx compatibility ([920e706](https://github.com/PaulHax/align-browser/commit/920e70631af17fabe0f3be9ec829f80cd8261bd6))


### Bug Fixes

* include frontend assets in Python package for PyPI ([8ea9213](https://github.com/PaulHax/align-browser/commit/8ea9213c48f5959857558669698db3b76964d0f4))

## 0.1.0 (2025-07-10)


### Features

* add automated PyPI publishing with semantic versioning ([936188a](https://github.com/PaulHax/align-browser/commit/936188a1cb63576e14f38edbd22e906e5178ae14))
* add comparison feature foundation with pin functionality ([a3854d8](https://github.com/PaulHax/align-browser/commit/a3854d8ef5cbf540aa230d99c8ad15e38d73d2ad))
* add comprehensive URL state management and fix frontend tests ([99f3a79](https://github.com/PaulHax/align-browser/commit/99f3a79f9ec039a728880903b9eec3bfd393a811))
* add editable ADM type selectors to pinned run table cells (Phase 5B) ([0d5ec97](https://github.com/PaulHax/align-browser/commit/0d5ec9736d99793e836aa614ccbad4c931c4a851))
* build script and static app files ([23d9c75](https://github.com/PaulHax/align-browser/commit/23d9c75155f5dfbcec08afcb6332ada180fef8b8))
* enhance build script with HTTP server and network support ([004b2e7](https://github.com/PaulHax/align-browser/commit/004b2e7455f88041c7a9241dade519bbd9fffc57))
* extract parameter validity logic into reusable functions (Phase 1) ([c094946](https://github.com/PaulHax/align-browser/commit/c0949467063bb8056c23fe2f3ff57a1c088e3647))
* generalize pinned run update code and fix removal persistence ([8688b5b](https://github.com/PaulHax/align-browser/commit/8688b5bad4eb690a049bf2d3f8fd2f998bb93b60))
* implement comprehensive comparison table with enhanced UX ([e78164b](https://github.com/PaulHax/align-browser/commit/e78164be0851e75848e4dedfa478101e837f38c3))
* implement editable KDMA value controls in pinned run table cells (Phase 5D) ([47c52b6](https://github.com/PaulHax/align-browser/commit/47c52b603617c552376cd544c88e869d96a94f4b))
* implement editable LLM selectors in pinned run table cells (Phase 5A) ([d2b7f1c](https://github.com/PaulHax/align-browser/commit/d2b7f1cbbf41cf1696ae00bb19cc9f9befb7bd16))
* implement editable scenario selectors in pinned run table cells (Phase 5C) ([ac3c64f](https://github.com/PaulHax/align-browser/commit/ac3c64ff7dbb5d61919b8c98a380812014a59feb))
* implement parameter auto-correction system (Phase 2) and fix KDMA behaviors ([90cc0a1](https://github.com/PaulHax/align-browser/commit/90cc0a1be43c14970f7770c0fdecb339964b4b04))
* implement run ID context system for multi-run parameter management (Phase 4) ([453322e](https://github.com/PaulHax/align-browser/commit/453322eafe7961e0d52e1374618e2b2193f765cf))
* implement side-by-side comparison display (Step 2) ([18df132](https://github.com/PaulHax/align-browser/commit/18df1322cc502e535496ff6c621e1efdb5c59337))
* move static elements to HTML template and improve layout ([30b495d](https://github.com/PaulHax/align-browser/commit/30b495d2b6040e567f38c58ace4a34f3c3679360))
* remove header and simplify HTML structure ([b5287a2](https://github.com/PaulHax/align-browser/commit/b5287a2a888269fa601a4c90f6dbbcaf8f57de9c))
* remove sidebar and implement auto-pin first column with add column functionality ([3efe846](https://github.com/PaulHax/align-browser/commit/3efe846c920fb7bd6cdb7fc4882be4360238ada9))
* reorganize run column cell order and clean up parameter categories ([39f95f4](https://github.com/PaulHax/align-browser/commit/39f95f48d2e4e15ff24e9b35534b4a511f1b1c43))
* replace KDMA dropdown with slider in table cells to match sidebar ([20f989b](https://github.com/PaulHax/align-browser/commit/20f989b74a21857ace517051ef74e9b4eb7b91c3))
* simplify results display and move scores to sidebar ([e0f8821](https://github.com/PaulHax/align-browser/commit/e0f8821640fbfea7105d8089d673f2a294f51243))
* update branding and fix score consistency ([548f82c](https://github.com/PaulHax/align-browser/commit/548f82cb33ae989e0641214ddf0f2ca90c87148b))


### Bug Fixes

* add required permissions for release-please workflow ([c2d4545](https://github.com/PaulHax/align-browser/commit/c2d4545789d23ca903d30762647ff9bce74abcf7))
* improve add column functionality and prevent deletion of last column ([f4dfbf0](https://github.com/PaulHax/align-browser/commit/f4dfbf0217292e581390b5801666edfe9c4f91d5))
* improve JSON display width and increase scenario state text limit ([44781f3](https://github.com/PaulHax/align-browser/commit/44781f3649875fd1c4a035afe56e71d45bc35acc))
* preserve natural ordering of scenario dropdown options ([06f1fe8](https://github.com/PaulHax/align-browser/commit/06f1fe8997c25bb95b8bc771cad952875820227d))
* prevent invalid KDMA combinations in table cell controls ([fa41032](https://github.com/PaulHax/align-browser/commit/fa410321ea73a8e9d179b1b619c45e5a87be65a9))
* remove deprecated package-name parameter from release-please ([41c734b](https://github.com/PaulHax/align-browser/commit/41c734bb815ffb8d57eb75c550ca8c5114ebdd0a))
* resolve KDMA table cell interaction bugs ([2c5529e](https://github.com/PaulHax/align-browser/commit/2c5529e87768cfa984e4f384c6879d388b78c3f7))
* update version file in release-please config ([6d3d695](https://github.com/PaulHax/align-browser/commit/6d3d695aa4f281cf54c5afffddc4f1385216ad7e))
* update workflow to have permissions for labels ([362ee28](https://github.com/PaulHax/align-browser/commit/362ee28e63cfced970f020e9dbe875784191aa24))
