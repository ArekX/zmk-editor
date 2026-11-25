package httpapi

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/ArekX/zmk-editor/internal/firmware"
	"github.com/ArekX/zmk-editor/internal/store"
)

type firmwareView struct {
	store.FirmwareDownload
	Files []firmware.File `json:"files"`
}

func (s *server) firmwareView(f store.FirmwareDownload) firmwareView {
	files, err := firmware.List(f.Dir)
	if err != nil {
		files = []firmware.File{}
	}
	return firmwareView{FirmwareDownload: f, Files: files}
}

func (s *server) listFirmware(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	list, err := s.Store.ListFirmware(repo.ID)
	if err != nil {
		s.fail(w, err)
		return
	}
	out := make([]firmwareView, 0, len(list))
	for _, f := range list {
		out = append(out, s.firmwareView(f))
	}
	writeJSON(w, http.StatusOK, out)
}

// downloadFirmware fetches an artifact zip from GitHub, extracts it into
// the cache and records it. Already-cached artifacts are returned as-is.
func (s *server) downloadFirmware(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	owner, name, ok := s.githubRepo(w, repo)
	if !ok {
		return
	}
	var in struct {
		ArtifactID int64  `json:"artifact_id"`
		RunID      int64  `json:"run_id"`
		Name       string `json:"name"`
		HeadSHA    string `json:"head_sha"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	if in.ArtifactID == 0 {
		writeError(w, http.StatusBadRequest, "artifact_id is required")
		return
	}
	if f, err := s.Store.GetFirmwareByArtifact(repo.ID, in.ArtifactID); err == nil {
		if _, statErr := os.Stat(f.Dir); statErr == nil {
			writeJSON(w, http.StatusOK, s.firmwareView(f))
			return
		}
	}
	base := filepath.Join(s.FirmwareDir, strconv.FormatInt(repo.ID, 10))
	if err := os.MkdirAll(base, 0o700); err != nil {
		s.fail(w, err)
		return
	}
	id := strconv.FormatInt(in.ArtifactID, 10)
	zipPath := filepath.Join(base, id+".zip")
	dir := filepath.Join(base, id)
	tmp, err := os.CreateTemp(base, id+"-*.part")
	if err != nil {
		s.fail(w, err)
		return
	}
	err = s.GitHub.DownloadArtifact(r.Context(), owner, name, in.ArtifactID, tmp)
	closeErr := tmp.Close()
	if err == nil {
		err = closeErr
	}
	if err == nil {
		err = os.Rename(tmp.Name(), zipPath)
	}
	if err != nil {
		_ = os.Remove(tmp.Name())
		s.fail(w, err)
		return
	}
	_ = os.RemoveAll(dir)
	if err := firmware.Extract(zipPath, dir); err != nil {
		s.fail(w, err)
		return
	}
	f, err := s.Store.CreateFirmware(store.FirmwareDownload{
		RepositoryID: repo.ID, ArtifactID: in.ArtifactID, RunID: in.RunID,
		Name: in.Name, HeadSHA: in.HeadSHA, Dir: dir,
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	f, _ = s.Store.GetFirmwareByArtifact(repo.ID, in.ArtifactID)
	writeJSON(w, http.StatusCreated, s.firmwareView(f))
}

// loadFirmware resolves {fw} within the repository in {id}.
func (s *server) loadFirmware(w http.ResponseWriter, r *http.Request) (store.FirmwareDownload, bool) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return store.FirmwareDownload{}, false
	}
	fwID, ok := pathInt(r, "fw")
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid firmware id")
		return store.FirmwareDownload{}, false
	}
	list, err := s.Store.ListFirmware(repo.ID)
	if err != nil {
		s.fail(w, err)
		return store.FirmwareDownload{}, false
	}
	for _, f := range list {
		if f.ID == fwID {
			return f, true
		}
	}
	writeError(w, http.StatusNotFound, "firmware not found")
	return store.FirmwareDownload{}, false
}

func (s *server) deleteFirmware(w http.ResponseWriter, r *http.Request) {
	f, ok := s.loadFirmware(w, r)
	if !ok {
		return
	}
	if err := s.Store.DeleteFirmware(f.ID); err != nil {
		s.fail(w, err)
		return
	}
	_ = os.RemoveAll(f.Dir)
	_ = os.Remove(f.Dir + ".zip")
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) firmwareFile(w http.ResponseWriter, r *http.Request) {
	f, ok := s.loadFirmware(w, r)
	if !ok {
		return
	}
	path, err := firmware.Resolve(f.Dir, r.PathValue("name"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filepath.Base(path)))
	http.ServeFile(w, r, path)
}

func (s *server) firmwareZip(w http.ResponseWriter, r *http.Request) {
	f, ok := s.loadFirmware(w, r)
	if !ok {
		return
	}
	name := f.Name
	if name == "" {
		name = "firmware"
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", name+".zip"))
	http.ServeFile(w, r, f.Dir+".zip")
}

func (s *server) listDevices(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, firmware.Devices())
}

func (s *server) flashFirmware(w http.ResponseWriter, r *http.Request) {
	f, ok := s.loadFirmware(w, r)
	if !ok {
		return
	}
	var in struct {
		File   string `json:"file"`
		Device string `json:"device"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	path, err := firmware.Resolve(f.Dir, in.File)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	dev, ok := firmware.FindDevice(in.Device)
	if !ok {
		writeError(w, http.StatusBadRequest, "no bootloader drive is mounted at "+in.Device)
		return
	}
	if err := firmware.Flash(path, dev); err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "flashed", "device": dev.Name})
}
