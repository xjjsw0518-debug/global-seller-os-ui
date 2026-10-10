# Visual baseline gate

The GSO Gate compares a 1440 x 900 screenshot of the home page against the
reviewed image in `backstop_data/bitmaps_reference` after the Playwright smoke
test passes.

Normal pushes and pull requests run `npm run test:visual`. The comparison keeps
BackstopJS's default `0.1%` mismatch threshold and requires identical image
dimensions.

To propose an intentional baseline change, manually run **GSO Gate** with
`update_visual_baseline` enabled. That run captures a candidate on the same
self-hosted runner and publishes it in the `backstop-visual-<run-id>` artifact.
Review the image before replacing the committed reference. Do not raise the
mismatch threshold or approve a changed reference only to make the gate pass.
