export default {
  spec_dir: "tests/spec", // Change this line
  spec_files: [
    "**/*[sS]pec.js"
  ],
  helpers: [
    "helpers/*/.js"
  ],
  env: {
    stopSpecOnExpectationFailure: false,
    random: false,
  }
}
