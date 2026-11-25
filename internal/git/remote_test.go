package git

import "testing"

func TestGitHubSlug(t *testing.T) {
	cases := map[string][2]string{
		"git@github.com:ArekX/zmk-config.git":           {"ArekX", "zmk-config"},
		"https://github.com/ArekX/zmk-config":           {"ArekX", "zmk-config"},
		"https://token@github.com/ArekX/zmk.config.git": {"ArekX", "zmk.config"},
		"ssh://git@github.com/a/b.git":                  {"a", "b"},
	}
	for in, want := range cases {
		o, r, ok := GitHubSlug(in)
		if !ok || o != want[0] || r != want[1] {
			t.Errorf("%s: got %s/%s %v", in, o, r, ok)
		}
	}
	if _, _, ok := GitHubSlug("git@gitlab.com:a/b.git"); ok {
		t.Error("gitlab accepted")
	}
}

func TestParseStatus(t *testing.T) {
	out := "# branch.oid abc\n# branch.head main\n# branch.upstream origin/main\n# branch.ab +2 -1\n" +
		"1 .M N... 100644 100644 100644 1 2 config/corne.keymap\n? new.txt\n"
	s := parseStatus(out)
	if s.Branch != "main" || s.Ahead != 2 || s.Behind != 1 || len(s.Files) != 2 {
		t.Fatalf("%+v", s)
	}
	if s.Files[0].Path != "config/corne.keymap" || s.Files[0].Status != "modified" {
		t.Fatalf("%+v", s.Files[0])
	}
}
