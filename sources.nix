# 派生先が管理。input は flake.nix の project inputs 区画に足す。adr/from-template/0005
inputs: {
  skills = {
    feature-sliced = { path = inputs.feature-sliced-skills.outPath; };
    google = { path = inputs.google-skills.outPath; subdir = "skills/cloud"; };
  };

  rules = {
  };
}
