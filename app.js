const tagDefinitions = [
  { name: "快攻", positiveKey: "q" },
  { name: "漏篮板", positiveKey: "w" },
  { name: "3分", positiveKey: "e" },
  { name: "2分", positiveKey: "r" },
  { name: "防守", positiveKey: "a" },
  { name: "无球未移动", positiveKey: "s" },
  { name: "传球选择", positiveKey: "d" },
];

const noteTemplates = ["", "沟通问题", "站位问题", "协防慢", "出球慢", "判断犹豫", "执行到位"];

const state = {
  stream: null,
  recorder: null,
  clipRecorder: null,
  recordingChunks: [],
  clipChunks: [],
  clips: [],
  clipId: 1,
  projectDir: null,
  fileUrl: "",
  fileName: "",
  recordingBlob: null,
  recordingFilename: "",
  recordingUrl: "",
  recordingStartedAt: 0,
  isRecording: false,
  sourceMode: "none",
  selectedTeam: "",
  selectedNumber: "",
  selectedResult: "问题",
  keyboardTeam: "home",
  activeSlotIndex: 0,
  isSlotInputMode: false,
  slotInputBuffer: "",
  lineup: {
    home: ["0", "1", "3", "5", "7"],
    away: ["2", "4", "6", "8", "12"],
  },
  players: {
    home: [],
    away: [],
  },
  events: [],
  eventId: 1,
  archiveMode: "player",
  archiveGroups: new Map(),
};

const draftKey = "basketball-tactical-desk-draft-v1";

const els = {
  video: document.querySelector("#liveVideo"),
  empty: document.querySelector("#emptyState"),
  sourceStatus: document.querySelector("#sourceStatus"),
  recordStatus: document.querySelector("#recordStatus"),
  clipStatus: document.querySelector("#clipStatus"),
  projectStatus: document.querySelector("#projectStatus"),
  eventStatus: document.querySelector("#eventStatus"),
  deviceSelect: document.querySelector("#deviceSelect"),
  refreshDevices: document.querySelector("#refreshDevices"),
  connectCamera: document.querySelector("#connectCamera"),
  fileInput: document.querySelector("#fileInput"),
  recordToggle: document.querySelector("#recordToggle"),
  downloadRecording: document.querySelector("#downloadRecording"),
  homeNumbers: document.querySelector("#homeNumbers"),
  awayNumbers: document.querySelector("#awayNumbers"),
  applyHome: document.querySelector("#applyHome"),
  applyAway: document.querySelector("#applyAway"),
  homePlayers: document.querySelector("#homePlayers"),
  awayPlayers: document.querySelector("#awayPlayers"),
  currentPlayer: document.querySelector("#currentPlayer"),
  keyboardTeam: document.querySelector("#keyboardTeam"),
  playerBuffer: document.querySelector("#playerBuffer"),
  lineupSlots: document.querySelector("#lineupSlots"),
  clearPlayer: document.querySelector("#clearPlayer"),
  phaseSelect: document.querySelector("#phaseSelect"),
  timeReadout: document.querySelector("#timeReadout"),
  resultToggle: document.querySelector("#resultToggle"),
  tagGrid: document.querySelector("#tagGrid"),
  recentList: document.querySelector("#recentList"),
  eventTable: document.querySelector("#eventTable"),
  clipList: document.querySelector("#clipList"),
  archiveByPlayer: document.querySelector("#archiveByPlayer"),
  archiveByTag: document.querySelector("#archiveByTag"),
  archiveList: document.querySelector("#archiveList"),
  chooseProjectFolder: document.querySelector("#chooseProjectFolder"),
  saveProjectFolder: document.querySelector("#saveProjectFolder"),
  undoLast: document.querySelector("#undoLast"),
  exportCsv: document.querySelector("#exportCsv"),
  exportProject: document.querySelector("#exportProject"),
  pageTabs: document.querySelector(".page-tabs"),
};

function parseNumbers(value) {
  return value
    .split(/[,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);
}

function formatSeconds(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const rest = String(safe % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function currentSeconds() {
  if (state.sourceMode === "file") return els.video.currentTime || 0;
  if (state.isRecording && state.recordingStartedAt) {
    return (performance.now() - state.recordingStartedAt) / 1000;
  }
  return 0;
}

function setStatus(element, text, tone = "muted") {
  element.textContent = text;
  element.classList.toggle("muted", tone === "muted");
  element.classList.toggle("hot", tone === "hot");
}

function setVideoReady(label, mode) {
  state.sourceMode = mode;
  els.empty.hidden = true;
  setStatus(els.sourceStatus, label, "ok");
  els.recordToggle.disabled = mode !== "camera";
}

function selectedPlayerLabel() {
  if (!state.selectedTeam || !state.selectedNumber) return "未指定球员";
  return `${state.selectedTeam === "home" ? "主队" : "客队"} ${state.selectedNumber}号`;
}

function renderPlayers(team) {
  const target = team === "home" ? els.homePlayers : els.awayPlayers;
  const teamLabel = team === "home" ? "主队" : "客队";
  target.innerHTML = state.players[team].map((number) => {
    const active = state.selectedTeam === team && state.selectedNumber === number ? " active" : "";
    return `<button class="${active}" type="button" data-team="${team}" data-number="${number}">${number}</button>`;
  }).join("");
  target.setAttribute("aria-label", `${teamLabel}球员号码`);
  els.currentPlayer.textContent = selectedPlayerLabel();
}

function renderAllPlayers() {
  renderPlayers("home");
  renderPlayers("away");
  renderKeyboardPlayer();
  renderLineupSlots();
}

function renderKeyboardPlayer() {
  els.keyboardTeam.textContent = state.keyboardTeam === "home" ? "主队" : "客队";
  const slotNumber = state.lineup[state.keyboardTeam][state.activeSlotIndex] || "未设";
  els.playerBuffer.textContent = state.isSlotInputMode
    ? `${state.activeSlotIndex + 1}号快捷位输入：${state.slotInputBuffer || "..."}`
    : `${state.keyboardTeam === "home" ? "主队" : "客队"} ${state.activeSlotIndex + 1}号快捷位：${slotNumber}`;
  els.playerBuffer.closest(".keyboard-player").classList.toggle("editing", state.isSlotInputMode);
  els.playerBuffer.closest(".keyboard-player").classList.toggle("away-team", state.keyboardTeam === "away");
}

function renderLineupSlots() {
  els.lineupSlots.innerHTML = state.lineup[state.keyboardTeam].map((number, index) => {
    const selected = state.selectedTeam === state.keyboardTeam && state.selectedNumber === number;
    const active = index === state.activeSlotIndex ? " active-slot" : "";
    return `
      <button class="${selected ? "selected " : ""}${active}" type="button" data-slot="${index}">
        <span>${index + 1}</span>
        <strong>${number || "-"}</strong>
      </button>
    `;
  }).join("");
}

function applyNumbers(team) {
  const input = team === "home" ? els.homeNumbers : els.awayNumbers;
  state.players[team] = parseNumbers(input.value);
  if (state.selectedTeam === team && !state.players[team].includes(state.selectedNumber)) {
    state.selectedTeam = "";
    state.selectedNumber = "";
  }
  renderAllPlayers();
  renderRecent();
  saveDraft();
}

function selectPlayer(team, number) {
  state.selectedTeam = team;
  state.selectedNumber = number;
  state.keyboardTeam = team || state.keyboardTeam;
  assignSelectedPlayerToSlot(team, number);
  renderAllPlayers();
}

function assignSelectedPlayerToSlot(team, number) {
  if (!team || !number || number === "未指定") return;
  state.lineup[team][state.activeSlotIndex] = number;
}

function selectLineupSlot(index) {
  state.activeSlotIndex = index;
  state.isSlotInputMode = false;
  state.slotInputBuffer = "";
  const number = state.lineup[state.keyboardTeam][index];
  if (number) {
    state.selectedTeam = state.keyboardTeam;
    state.selectedNumber = number;
  }
  renderAllPlayers();
}

function confirmSlotInput() {
  const number = state.slotInputBuffer.trim();
  if (!number) return;

  if (!state.players[state.keyboardTeam].includes(number)) {
    state.players[state.keyboardTeam].push(number);
    const input = state.keyboardTeam === "home" ? els.homeNumbers : els.awayNumbers;
    input.value = state.players[state.keyboardTeam].join(",");
  }

  state.lineup[state.keyboardTeam][state.activeSlotIndex] = number;
  state.selectedTeam = state.keyboardTeam;
  state.selectedNumber = number;
  state.isSlotInputMode = false;
  state.slotInputBuffer = "";
  renderAllPlayers();
  saveDraft();
}

function getSupportedMime() {
  const options = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4;codecs=h264,aac",
    "video/mp4",
  ];
  if (!window.MediaRecorder || typeof MediaRecorder.isTypeSupported !== "function") return "";
  return options.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function captureMediaStream(video) {
  if (typeof video.captureStream === "function") return video.captureStream();
  if (typeof video.mozCaptureStream === "function") return video.mozCaptureStream();
  return null;
}

async function loadDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    els.deviceSelect.innerHTML = '<option value="">当前浏览器不能读取视频设备</option>';
    return;
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoDevices = devices.filter((device) => device.kind === "videoinput");
  if (!videoDevices.length) {
    els.deviceSelect.innerHTML = '<option value="">未发现视频设备</option>';
    return;
  }

  els.deviceSelect.innerHTML = videoDevices.map((device, index) => {
    const label = device.label || `视频设备 ${index + 1}`;
    return `<option value="${device.deviceId}">${label}</option>`;
  }).join("");
}

async function connectCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
  }

  const deviceId = els.deviceSelect.value;
  const videoConstraints = deviceId
    ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
    : { width: { ideal: 1920 }, height: { ideal: 1080 } };
  const constraints = {
    video: videoConstraints,
    audio: true,
  };
  const videoOnlyConstraints = {
    video: videoConstraints,
    audio: false,
  };

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    stream = await navigator.mediaDevices.getUserMedia(videoOnlyConstraints);
    setStatus(els.sourceStatus, "摄像机已连接，但未接入声音", "hot");
  }

  state.stream = stream;
  els.video.srcObject = stream;
  els.video.controls = false;
  els.video.muted = true;
  setVideoReady(stream.getAudioTracks().length ? "摄像机已连接" : "摄像机已连接，无声音", "camera");
  startClipBuffer(stream);
  await loadDevices();

  stream.getVideoTracks().forEach((track) => {
    track.addEventListener("ended", () => {
      setStatus(els.sourceStatus, "摄像机可能已断开", "hot");
    });
  });
}

function cameraErrorMessage(error) {
  if (!navigator.mediaDevices?.getUserMedia) return "当前浏览器不能连接摄像机，请用 Chrome 或 Edge";
  if (error?.name === "NotAllowedError") return "浏览器没有摄像机权限，请在地址栏允许摄像机";
  if (error?.name === "NotFoundError") return "电脑没有发现摄像机，请检查采集卡/数据线";
  if (error?.name === "NotReadableError") return "摄像机被其他软件占用，请关闭相机、腾讯会议等软件";
  if (error?.name === "OverconstrainedError") return "这个摄像机参数不匹配，请刷新设备后重试";
  if (error?.name === "SecurityError") return "浏览器拦截了摄像机权限，请用 127.0.0.1 或 localhost 打开";
  return "摄像机连接失败，请检查设备和浏览器权限";
}

async function connectCameraWithStatus() {
  try {
    await connectCamera();
  } catch (error) {
    setStatus(els.sourceStatus, cameraErrorMessage(error), "hot");
    throw error;
  }
}

function loadVideoFile(file) {
  if (!file) return;
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
  }
  stopClipBuffer();
  stopRecording();
  if (state.fileUrl) URL.revokeObjectURL(state.fileUrl);
  state.fileUrl = URL.createObjectURL(file);
  state.fileName = file.name || "imported-video";
  els.video.srcObject = null;
  els.video.src = state.fileUrl;
  els.video.controls = true;
  els.video.muted = false;
  els.video.play().catch(() => {});
  setVideoReady("已导入视频", "file");
  updateImportedClipCapability();
}

function updateImportedClipCapability() {
  const canRecord = Boolean(window.MediaRecorder);
  const canCaptureVideo = Boolean(captureMediaStream(document.createElement("video")));
  const canCaptureCanvas = Boolean(document.createElement("canvas").captureStream);

  if (canRecord && canCaptureVideo) {
    setStatus(els.clipStatus, "导入视频可自动截片", "ok");
  } else if (canRecord && canCaptureCanvas) {
    setStatus(els.clipStatus, "导入视频可截片：无声兼容模式", "ok");
  } else {
    setStatus(els.clipStatus, "当前浏览器不支持自动截片", "hot");
  }
}

function startRecording() {
  if (!state.stream || state.isRecording) return;
  state.recordingChunks = [];
  if (state.recordingUrl) URL.revokeObjectURL(state.recordingUrl);
  state.recordingUrl = "";
  els.downloadRecording.classList.add("disabled");
  els.downloadRecording.removeAttribute("href");

  const mimeType = getSupportedMime();
  state.recorder = new MediaRecorder(state.stream, mimeType ? { mimeType } : undefined);
  state.recorder.ondataavailable = (event) => {
    if (event.data.size > 0) state.recordingChunks.push(event.data);
  };
  state.recorder.onerror = () => {
    setStatus(els.recordStatus, "录像异常，请检查设备", "hot");
  };
  state.recorder.onstop = finishRecording;
  state.recorder.start(1000);
  state.recordingStartedAt = performance.now();
  state.isRecording = true;
  els.recordToggle.textContent = "结束录像";
  setStatus(els.recordStatus, "正在录像", "hot");
}

function stopRecording() {
  if (state.recorder && state.recorder.state !== "inactive") {
    state.recorder.stop();
  }
}

function finishRecording() {
  state.isRecording = false;
  els.recordToggle.textContent = "开始录像";
  setStatus(els.recordStatus, "录像已结束", "muted");

  if (!state.recordingChunks.length) return;
  const blob = new Blob(state.recordingChunks, { type: state.recordingChunks[0].type || "video/webm" });
  state.recordingBlob = blob;
  state.recordingFilename = `full-game-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
  state.recordingUrl = URL.createObjectURL(blob);
  els.downloadRecording.href = state.recordingUrl;
  els.downloadRecording.download = state.recordingFilename;
  els.downloadRecording.classList.remove("disabled");
  saveRecordingToProject();
}

function startClipBuffer(stream) {
  stopClipBuffer();
  state.clipChunks = [];

  try {
    const mimeType = getSupportedMime();
    state.clipRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    state.clipRecorder.ondataavailable = (event) => {
      if (event.data.size <= 0) return;
      const timeSeconds = currentSeconds();
      state.clipChunks.push({
        blob: event.data,
        timeSeconds,
        type: event.data.type || "video/webm",
      });
      state.clipChunks = state.clipChunks.filter((chunk) => timeSeconds - chunk.timeSeconds <= 45);
    };
    state.clipRecorder.onerror = () => {
      setStatus(els.clipStatus, "自动片段缓存异常", "hot");
    };
    state.clipRecorder.start(1000);
    setStatus(els.clipStatus, "自动片段缓存中", "ok");
  } catch {
    setStatus(els.clipStatus, "自动片段不可用", "hot");
  }
}

function stopClipBuffer() {
  if (state.clipRecorder && state.clipRecorder.state !== "inactive") {
    state.clipRecorder.stop();
  }
  state.clipRecorder = null;
}

function renderTags() {
  els.resultToggle.innerHTML = ["正面", "问题"].map((result) => `
    <button class="result-btn ${state.selectedResult === result ? "active" : ""}" type="button" data-result="${result}">
      <span class="keycap">${result === "正面" ? "Z" : "X"}</span> ${result}
    </button>
  `).join("");

  els.tagGrid.innerHTML = tagDefinitions.map((tag) => `
    <button class="tag-btn compact-tag" type="button" data-tag="${tag.name}">
      <span class="keycap">${tag.positiveKey.toUpperCase()}</span>
      <strong>${tag.name}</strong>
    </button>
  `).join("");
}

function addEvent(tag, result) {
  const seconds = currentSeconds();
  const event = {
    id: state.eventId++,
    createdAt: new Date().toISOString(),
    timeSeconds: Number(seconds.toFixed(2)),
    timeLabel: formatSeconds(seconds),
    phase: els.phaseSelect.value,
    team: state.selectedTeam ? (state.selectedTeam === "home" ? "主队" : "客队") : "未指定",
    teamKey: state.selectedTeam,
    number: state.selectedNumber || "未指定",
    tag,
    result,
    note: "",
    clipStatus: "等待生成",
    clipId: "",
    important: false,
  };
  state.events.unshift(event);
  renderEvents();
  if (state.sourceMode === "file") {
    generateClipFromImportedVideo(event);
  } else {
    scheduleAutoClip(event);
  }
  saveDraft();
}

async function generateClipFromImportedVideo(event) {
  if (!state.fileUrl || !window.MediaRecorder) {
    event.clipStatus = "当前浏览器不支持";
    renderEvents();
    saveDraft();
    return;
  }

  const clipVideo = document.createElement("video");
  clipVideo.src = state.fileUrl;
  clipVideo.muted = true;
  clipVideo.playsInline = true;
  clipVideo.preload = "auto";
  clipVideo.style.position = "fixed";
  clipVideo.style.left = "-9999px";
  clipVideo.style.width = "1px";
  clipVideo.style.height = "1px";
  document.body.appendChild(clipVideo);

  const cleanup = () => {
    clipVideo.pause();
    clipVideo.removeAttribute("src");
    clipVideo.load();
    clipVideo.remove();
  };

  try {
    event.clipStatus = "正在生成";
    setStatus(els.clipStatus, "正在从导入视频截取片段", "hot");
    renderEvents();

    await waitForVideoEvent(clipVideo, "loadedmetadata");
    const preRoll = 8;
    const postRoll = 6;
    const start = Math.max(0, event.timeSeconds - preRoll);
    const end = Math.min(clipVideo.duration || event.timeSeconds + postRoll, event.timeSeconds + postRoll);
    const duration = Math.max(1, end - start);
    clipVideo.currentTime = start;
    await waitForVideoEvent(clipVideo, "seeked");

    const result = captureMediaStream(clipVideo)
      ? await recordVideoElementClip(clipVideo, duration)
      : await recordCanvasClip(clipVideo, duration);
    createClipFromBlob(event, result.blob, result.sourceLabel);
    setStatus(els.clipStatus, `已生成 ${state.clips.length} 个片段`, "ok");
  } catch {
    event.clipStatus = "生成失败";
    setStatus(els.clipStatus, "导入视频截片失败，请换 Chrome/Edge 或使用摄像机实时录制", "hot");
    renderEvents();
    saveDraft();
  } finally {
    cleanup();
  }
}

function waitForVideoEvent(video, eventName) {
  return new Promise((resolve, reject) => {
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(eventName));
    };
    const cleanup = () => {
      video.removeEventListener(eventName, onEvent);
      video.removeEventListener("error", onError);
    };

    if (eventName === "loadedmetadata" && video.readyState >= 1) {
      resolve();
      return;
    }
    video.addEventListener(eventName, onEvent, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

async function recordVideoElementClip(video, duration) {
  const stream = captureMediaStream(video);
  if (!stream) throw new Error("captureStream unsupported");
  const blob = await recordStreamForDuration(stream, video, duration);
  return { blob, sourceLabel: "导入视频截取" };
}

async function recordCanvasClip(video, duration) {
  const canvas = document.createElement("canvas");
  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context || typeof canvas.captureStream !== "function") {
    throw new Error("canvas capture unsupported");
  }

  const stream = canvas.captureStream(30);
  let drawing = true;
  const draw = () => {
    if (!drawing) return;
    context.drawImage(video, 0, 0, width, height);
    requestAnimationFrame(draw);
  };

  draw();
  const blob = await recordStreamForDuration(stream, video, duration);
  drawing = false;
  return { blob, sourceLabel: "导入视频截取（无声）" };
}

async function recordStreamForDuration(stream, video, duration) {
  const mimeType = getSupportedMime();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  recorder.ondataavailable = (recordEvent) => {
    if (recordEvent.data.size > 0) chunks.push(recordEvent.data);
  };

  const stopped = new Promise((resolve) => {
    recorder.onstop = resolve;
  });

  recorder.start(500);
  await video.play();
  window.setTimeout(() => {
    if (recorder.state !== "inactive") {
      recorder.requestData();
      recorder.stop();
    }
    video.pause();
  }, duration * 1000);
  await stopped;
  stream.getTracks().forEach((track) => track.stop());

  if (!chunks.length) throw new Error("empty clip");
  return new Blob(chunks, { type: chunks[0].type || mimeType || "video/webm" });
}

function safeDownloadName(name) {
  return String(name || "归纳视频").replace(/[\\/:*?"<>|]/g, "-");
}

function downloadUrl(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function mergeArchiveGroup(groupKey, triggerButton) {
  const group = state.archiveGroups.get(groupKey);
  if (!group || !group.clips.length || !window.MediaRecorder) return;

  const originalText = triggerButton?.textContent;
  if (triggerButton) {
    triggerButton.disabled = true;
    triggerButton.textContent = "正在生成...";
  }
  setStatus(els.clipStatus, `正在生成「${group.title}」整体视频`, "hot");
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const context = canvas.getContext("2d");
    if (!context || typeof canvas.captureStream !== "function") throw new Error("canvas unsupported");

    const stream = canvas.captureStream(30);
    const mimeType = getSupportedMime();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    const stopped = new Promise((resolve) => {
      recorder.onstop = resolve;
    });

    recorder.start(500);
    for (const item of group.clips) {
      await drawClipToCanvas(item.clip.url, context, canvas);
    }
    recorder.requestData();
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());

    if (!chunks.length) throw new Error("empty merged clip");
    const blob = new Blob(chunks, { type: chunks[0].type || mimeType || "video/webm" });
    const url = URL.createObjectURL(blob);
    const extension = blob.type.includes("mp4") ? "mp4" : "webm";
    const filename = `${safeDownloadName(group.title)}-整体归纳.${extension}`;
    const card = els.archiveList.querySelector(`[data-group="${CSS.escape(encodeURIComponent(groupKey))}"]`);
    const link = card?.querySelector(`[data-merged-link="${CSS.escape(encodeURIComponent(groupKey))}"]`);
    if (link) {
      link.href = url;
      link.download = filename;
      link.textContent = "再次下载整体视频";
      link.hidden = false;
    }
    downloadUrl(url, filename);
    setStatus(els.clipStatus, `「${group.title}」整体视频已下载`, "ok");
  } catch {
    setStatus(els.clipStatus, "整体视频生成失败", "hot");
  } finally {
    if (triggerButton) {
      triggerButton.disabled = false;
      triggerButton.textContent = originalText;
    }
  }
}

function drawClipToCanvas(url, context, canvas) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    let done = false;
    const cleanup = () => {
      done = true;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
    const draw = () => {
      if (done) return;
      context.fillStyle = "#000";
      context.fillRect(0, 0, canvas.width, canvas.height);
      const ratio = Math.min(canvas.width / (video.videoWidth || canvas.width), canvas.height / (video.videoHeight || canvas.height));
      const width = (video.videoWidth || canvas.width) * ratio;
      const height = (video.videoHeight || canvas.height) * ratio;
      const x = (canvas.width - width) / 2;
      const y = (canvas.height - height) / 2;
      context.drawImage(video, x, y, width, height);
      requestAnimationFrame(draw);
    };

    video.addEventListener("loadedmetadata", () => {
      draw();
      video.play().catch(reject);
    }, { once: true });
    video.addEventListener("ended", () => {
      cleanup();
      resolve();
    }, { once: true });
    video.addEventListener("error", () => {
      cleanup();
      reject(new Error("video error"));
    }, { once: true });
  });
}

function playArchiveGroup(groupKey, card) {
  const group = state.archiveGroups.get(groupKey);
  if (!group || !group.clips.length) return;
  const video = card.querySelector("video");
  let index = 0;
  const playNext = () => {
    if (index >= group.clips.length) return;
    video.src = group.clips[index].clip.url;
    index += 1;
    video.play().catch(() => {});
  };
  video.onended = playNext;
  playNext();
}

function scheduleAutoClip(event) {
  if (!state.clipRecorder || state.clipRecorder.state !== "recording") {
    event.clipStatus = "无视频缓存";
    renderEvents();
    saveDraft();
    return;
  }

  setStatus(els.clipStatus, "正在等待片段后6秒", "hot");
  window.setTimeout(() => {
    const preRoll = 8;
    const postRoll = 6;
    const start = Math.max(0, event.timeSeconds - preRoll);
    const end = event.timeSeconds + postRoll;
    const chunks = state.clipChunks.filter((chunk) => (
      chunk.timeSeconds >= start && chunk.timeSeconds <= end
    ));

    if (!chunks.length) {
      event.clipStatus = "生成失败";
      setStatus(els.clipStatus, "片段生成失败：缓存不足", "hot");
      renderEvents();
      saveDraft();
      return;
    }

    const blob = new Blob(chunks.map((chunk) => chunk.blob), { type: chunks[0].type || "video/webm" });
    createClipFromBlob(event, blob, "实时缓存截取");
    setStatus(els.clipStatus, `已生成 ${state.clips.length} 个片段`, "ok");
    renderEvents();
    renderClips();
    saveDraft();
  }, 6350);
}

function createClipFromBlob(event, blob, sourceLabel) {
  const url = URL.createObjectURL(blob);
  const extension = blob.type.includes("mp4") ? "mp4" : "webm";
  const clip = {
    id: state.clipId++,
    eventId: event.id,
    blob,
    url,
    filename: `${event.team}-${event.number}号-${event.tag}-${event.result}-${event.timeLabel.replace(":", "-")}.${extension}`,
    title: `${event.team} ${event.number}号 ${event.tag}${event.result === "正面" ? "+" : "-"}`,
    meta: `${event.phase} · ${event.timeLabel} · 前8秒后6秒 · ${sourceLabel}`,
  };

  state.clips.unshift(clip);
  event.clipStatus = "已生成";
  event.clipId = clip.id;
  renderEvents();
  renderClips();
  saveDraft();
  saveClipToProject(clip);
}

function removeEvent(id) {
  state.events = state.events.filter((event) => event.id !== id);
    state.clips = state.clips.filter((clip) => {
      if (clip.eventId !== id) return true;
      URL.revokeObjectURL(clip.url);
      return false;
    });
  renderEvents();
  renderClips();
  saveDraft();
}

function updateEvent(id, field, value) {
  const event = state.events.find((item) => item.id === id);
  if (!event) return;

  if (field === "player") {
    const [teamKey, number] = value.split(":");
    event.teamKey = teamKey;
    event.team = teamKey === "home" ? "主队" : teamKey === "away" ? "客队" : "未指定";
    event.number = number || "未指定";
  } else {
    event[field] = value;
  }
  renderEvents();
  saveDraft();
}

function playerOptions(selectedTeamKey, selectedNumber) {
  const options = ['<option value=":未指定">未指定</option>'];
  for (const team of ["home", "away"]) {
    const label = team === "home" ? "主队" : "客队";
    state.players[team].forEach((number) => {
      const selected = selectedTeamKey === team && selectedNumber === number ? " selected" : "";
      options.push(`<option value="${team}:${number}"${selected}>${label} ${number}号</option>`);
    });
  }
  return options.join("");
}

function tagOptions(selected) {
  return tagDefinitions.map((tag) => (
    `<option value="${tag.name}"${tag.name === selected ? " selected" : ""}>${tag.name}</option>`
  )).join("");
}

function resultOptions(selected) {
  return ["正面", "问题"].map((result) => (
    `<option value="${result}"${result === selected ? " selected" : ""}>${result}</option>`
  )).join("");
}

function noteOptions(selected) {
  return noteTemplates.map((note) => (
    `<option value="${note}"${note === selected ? " selected" : ""}>${note || "无备注"}</option>`
  )).join("");
}

function renderRecent() {
  const recent = state.events.slice(0, 5);
  if (!recent.length) {
    els.recentList.innerHTML = '<div class="empty-list">暂无最近记录</div>';
    return;
  }

  els.recentList.innerHTML = recent.map((event) => `
    <article class="recent-card" data-id="${event.id}">
      <div>
        <strong>${event.timeLabel}</strong>
        <small>${event.phase}</small>
      </div>
      <select data-field="player">${playerOptions(event.teamKey, event.number)}</select>
      <select data-field="tag">${tagOptions(event.tag)}</select>
      <select data-field="result">${resultOptions(event.result)}</select>
      <select data-field="note">${noteOptions(event.note)}</select>
      <span class="clip-state">${event.clipStatus || "未生成"}</span>
    </article>
  `).join("");
}

function renderEventTable() {
  if (!state.events.length) {
    els.eventTable.innerHTML = '<div class="empty-list">暂无事件记录</div>';
    return;
  }

  const rows = state.events.map((event) => `
    <tr>
      <td>${event.timeLabel}</td>
      <td>${event.phase}</td>
      <td>${event.team}</td>
      <td>${event.number}</td>
      <td>${event.tag}</td>
      <td>${event.result}</td>
      <td>${event.note || "-"}</td>
      <td>${event.clipStatus || "-"}</td>
      <td>
        <button type="button" data-generate="${event.id}">生成片段</button>
        <button type="button" data-delete="${event.id}">删除</button>
      </td>
    </tr>
  `).join("");

  els.eventTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>时间</th>
          <th>阶段</th>
          <th>球队</th>
          <th>球员</th>
          <th>标签</th>
          <th>正面/问题</th>
          <th>备注</th>
          <th>片段</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderEvents() {
  els.eventStatus.textContent = `${state.events.length} 条记录`;
  renderRecent();
  renderEventTable();
}

function renderClips() {
  if (!state.clips.length) {
    els.clipList.innerHTML = '<div class="empty-list">暂无自动片段</div>';
    renderArchive();
    return;
  }

  els.clipList.innerHTML = state.clips.map((clip) => `
    <article class="clip-card">
      <video src="${clip.url}" controls playsinline></video>
      <div class="clip-meta">
        <strong>${clip.title}</strong>
        <small>${clip.meta}</small>
        <a href="${clip.url}" download="${clip.filename}">下载片段</a>
      </div>
    </article>
  `).join("");
  renderArchive();
}

function eventById(id) {
  return state.events.find((event) => event.id === id);
}

function archiveGroupKey(event, mode) {
  if (mode === "player") {
    return `${event.teamKey || "unknown"}|${event.number || "未指定"}`;
  }
  return event.tag || "未分类";
}

function archiveGroupTitle(event, mode) {
  if (mode === "player") {
    return `${event.team} ${event.number}号`;
  }
  return event.tag || "未分类";
}

function archiveSectionTitle(event, mode) {
  if (mode === "player") {
    return `${event.tag} · ${event.result}`;
  }
  return event.result;
}

function renderArchiveSections(group) {
  const sections = new Map();
  group.clips.forEach((item) => {
    const section = archiveSectionTitle(item.event, state.archiveMode);
    if (!sections.has(section)) sections.set(section, []);
    sections.get(section).push(item);
  });

  return [...sections.entries()].map(([title, items]) => `
    <div class="archive-section">
      <div class="archive-section-title">
        <strong>${title}</strong>
        <span>${items.length} 个片段</span>
      </div>
      <div class="archive-section-items">
        ${items.map(({ event, clip }) => `
          <a href="${clip.url}" download="${clip.filename}">
            <span>${event.timeLabel}</span>
            <small>${event.team} ${event.number}号 · ${event.tag} · ${event.result}</small>
          </a>
        `).join("")}
      </div>
    </div>
  `).join("");
}

function buildArchiveGroups() {
  const groups = new Map();
  state.clips.forEach((clip) => {
    const event = eventById(clip.eventId);
    if (!event) return;
    const key = archiveGroupKey(event, state.archiveMode);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        title: archiveGroupTitle(event, state.archiveMode),
        result: event.result,
        clips: [],
      });
    }
    groups.get(key).clips.push({ clip, event });
  });
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
}

function renderArchive() {
  const groups = buildArchiveGroups();
  state.archiveGroups = new Map(groups.map((group) => [group.key, group]));
  els.archiveByPlayer.classList.toggle("active", state.archiveMode === "player");
  els.archiveByTag.classList.toggle("active", state.archiveMode === "tag");

  if (!groups.length) {
    els.archiveList.innerHTML = '<div class="empty-list">暂无可归纳片段</div>';
    return;
  }

  els.archiveList.innerHTML = groups.map((group) => {
    const safeKey = encodeURIComponent(group.key);
    const firstClip = group.clips[0].clip;
    const times = group.clips.map(({ event }) => event.timeLabel).join(" / ");
    return `
      <details class="archive-card archive-folder" data-group="${safeKey}">
        <summary class="archive-folder-summary">
          <span class="folder-mark">▸</span>
          <div class="archive-meta">
            <strong>${group.title}</strong>
            <span>${group.clips.length} 个片段 · ${times}</span>
          </div>
        </summary>
        <div class="archive-folder-body">
          <video src="${firstClip.url}" controls playsinline></video>
          <div class="archive-actions">
            <button type="button" data-play-group="${safeKey}">连续播放本文件夹</button>
            <button type="button" data-merge-group="${safeKey}">下载整体视频</button>
            <a class="merged-link" data-merged-link="${safeKey}" hidden>再次下载整体视频</a>
          </div>
          <div class="archive-sections">
            ${renderArchiveSections(group)}
          </div>
        </div>
      </details>
    `;
  }).join("");
}

function saveDraft() {
  const payload = {
    players: state.players,
    lineup: state.lineup,
    keyboardTeam: state.keyboardTeam,
    activeSlotIndex: state.activeSlotIndex,
    selectedResult: state.selectedResult,
    selectedTeam: state.selectedTeam,
    selectedNumber: state.selectedNumber,
    events: state.events,
    eventId: state.eventId,
    phase: els.phaseSelect.value,
  };
  localStorage.setItem(draftKey, JSON.stringify(payload));
}

function loadDraft() {
  const raw = localStorage.getItem(draftKey);
  if (!raw) return false;

  try {
    const draft = JSON.parse(raw);
    state.players = draft.players || state.players;
    state.lineup = draft.lineup || state.lineup;
    state.keyboardTeam = draft.keyboardTeam || "home";
    state.activeSlotIndex = Number(draft.activeSlotIndex || 0);
    state.isSlotInputMode = false;
    state.slotInputBuffer = "";
    state.selectedResult = draft.selectedResult || "问题";
    state.selectedTeam = draft.selectedTeam || "";
    state.selectedNumber = draft.selectedNumber || "";
    state.events = Array.isArray(draft.events)
      ? draft.events.map((event) => ({
        ...event,
        clipStatus: event.clipStatus === "已生成" ? "需重新生成" : event.clipStatus,
        clipId: event.clipStatus === "已生成" ? "" : event.clipId,
      }))
      : [];
    state.eventId = Number(draft.eventId || 1);
    if (draft.phase) els.phaseSelect.value = draft.phase;
    els.homeNumbers.value = state.players.home.join(",");
    els.awayNumbers.value = state.players.away.join(",");
    return true;
  } catch {
    return false;
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function supportsProjectFolder() {
  return typeof window.showDirectoryPicker === "function";
}

async function chooseProjectFolder() {
  if (!supportsProjectFolder()) {
    setStatus(els.projectStatus, "请使用 Windows Chrome/Edge 选择文件夹", "hot");
    return;
  }

  try {
    state.projectDir = await window.showDirectoryPicker({ mode: "readwrite" });
    setStatus(els.projectStatus, "项目文件夹已选择", "ok");
    await saveProjectToFolder();
  } catch {
    setStatus(els.projectStatus, "未选择项目文件夹", "muted");
  }
}

async function getProjectSubdir(name) {
  if (!state.projectDir) return null;
  return state.projectDir.getDirectoryHandle(name, { create: true });
}

async function writeFile(directoryHandle, filename, blob) {
  const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

async function saveClipToProject(clip) {
  if (!state.projectDir || !clip.blob) return;

  try {
    const clipsDir = await getProjectSubdir("clips");
    await writeFile(clipsDir, clip.filename, clip.blob);
    setStatus(els.projectStatus, "片段已保存到项目文件夹", "ok");
  } catch {
    setStatus(els.projectStatus, "片段保存失败，请重新选择文件夹", "hot");
  }
}

async function saveRecordingToProject() {
  if (!state.projectDir || !state.recordingBlob) return;

  try {
    const videosDir = await getProjectSubdir("recordings");
    await writeFile(videosDir, state.recordingFilename, state.recordingBlob);
    setStatus(els.projectStatus, "整场录像已保存到项目文件夹", "ok");
  } catch {
    setStatus(els.projectStatus, "整场录像保存失败", "hot");
  }
}

function projectPayload() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    sourceMode: state.sourceMode,
    players: state.players,
    currentPhase: els.phaseSelect.value,
    tags: tagDefinitions.map(({ name, positiveKey }) => ({ name, positiveKey })),
    events: state.events.slice().reverse(),
    clips: state.clips.map(({ id, eventId, filename, title, meta }) => ({ id, eventId, filename, title, meta })),
    recording: state.recordingFilename || "",
  };
}

function eventsCsvText() {
  const header = ["时间", "秒数", "阶段", "球队", "球员", "标签", "正面/问题", "备注", "片段状态", "创建时间"];
  const rows = state.events.slice().reverse().map((event) => [
    event.timeLabel,
    event.timeSeconds,
    event.phase,
    event.team,
    event.number,
    event.tag,
    event.result,
    event.note,
    event.clipStatus,
    event.createdAt,
  ]);
  return [header, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
}

async function saveProjectToFolder() {
  if (!state.projectDir) {
    await chooseProjectFolder();
    return;
  }

  try {
    const dataDir = await getProjectSubdir("data");
    await writeFile(dataDir, "events.csv", new Blob([`\ufeff${eventsCsvText()}`], { type: "text/csv;charset=utf-8" }));
    await writeFile(dataDir, "project.json", new Blob([JSON.stringify(projectPayload(), null, 2)], { type: "application/json;charset=utf-8" }));

    for (const clip of state.clips) {
      await saveClipToProject(clip);
    }
    await saveRecordingToProject();
    setStatus(els.projectStatus, "项目已保存到文件夹", "ok");
  } catch {
    setStatus(els.projectStatus, "项目保存失败，请重新选择文件夹", "hot");
  }
}

function csvValue(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportCsv() {
  const blob = new Blob([`\ufeff${eventsCsvText()}`], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `basketball-events-${new Date().toISOString().slice(0, 10)}.csv`);
}

function exportProject() {
  const blob = new Blob([JSON.stringify(projectPayload(), null, 2)], { type: "application/json;charset=utf-8" });
  downloadBlob(blob, `basketball-project-${new Date().toISOString().slice(0, 10)}.json`);
}

function bindEvents() {
  els.refreshDevices.addEventListener("click", () => {
    loadDevices().catch(() => setStatus(els.sourceStatus, "读取设备失败", "hot"));
  });

  els.connectCamera.addEventListener("click", () => {
    connectCameraWithStatus().catch(() => {});
  });

  els.fileInput.addEventListener("change", (event) => loadVideoFile(event.target.files[0]));

  els.recordToggle.addEventListener("click", () => {
    if (state.isRecording) stopRecording();
    else startRecording();
  });

  els.applyHome.addEventListener("click", () => applyNumbers("home"));
  els.applyAway.addEventListener("click", () => applyNumbers("away"));
  els.clearPlayer.addEventListener("click", () => {
    state.selectedTeam = "";
    state.selectedNumber = "";
    renderAllPlayers();
  });

  [els.homePlayers, els.awayPlayers].forEach((container) => {
    container.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-team]");
      if (!button) return;
      selectPlayer(button.dataset.team, button.dataset.number);
    });
  });

  els.lineupSlots.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-slot]");
    if (!button) return;
    selectLineupSlot(Number(button.dataset.slot));
  });

  els.tagGrid.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-tag]");
    if (!button) return;
    addEvent(button.dataset.tag, state.selectedResult);
  });

  els.resultToggle.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-result]");
    if (!button) return;
    state.selectedResult = button.dataset.result;
    renderTags();
  });

  els.recentList.addEventListener("change", (event) => {
    const select = event.target.closest("select[data-field]");
    const card = event.target.closest("[data-id]");
    if (!select || !card) return;
    updateEvent(Number(card.dataset.id), select.dataset.field, select.value);
  });

  els.eventTable.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("button[data-delete]");
    if (deleteButton) {
      removeEvent(Number(deleteButton.dataset.delete));
      return;
    }

    const generateButton = event.target.closest("button[data-generate]");
    if (generateButton) {
      const item = state.events.find((entry) => entry.id === Number(generateButton.dataset.generate));
      if (!item) return;
      if (state.sourceMode === "file") generateClipFromImportedVideo(item);
      else scheduleAutoClip(item);
    }
  });

  els.archiveByPlayer.addEventListener("click", () => {
    state.archiveMode = "player";
    renderArchive();
  });

  els.archiveByTag.addEventListener("click", () => {
    state.archiveMode = "tag";
    renderArchive();
  });

  els.archiveList.addEventListener("click", (event) => {
    const playButton = event.target.closest("button[data-play-group]");
    if (playButton) {
      const key = decodeURIComponent(playButton.dataset.playGroup);
      playArchiveGroup(key, playButton.closest(".archive-card"));
      return;
    }
    const mergeButton = event.target.closest("button[data-merge-group]");
    if (mergeButton) {
      const key = decodeURIComponent(mergeButton.dataset.mergeGroup);
      mergeArchiveGroup(key, mergeButton);
    }
  });

  els.pageTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-page]");
    if (!button) return;
    const page = button.dataset.page;
    document.querySelectorAll(".page-tabs button").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.page === page);
    });
    document.querySelectorAll(".app-page").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.pagePanel === page);
    });
  });

  els.undoLast.addEventListener("click", () => {
    if (!state.events.length) return;
    const [event] = state.events.splice(0, 1);
    state.clips = state.clips.filter((clip) => {
      if (clip.eventId !== event.id) return true;
      URL.revokeObjectURL(clip.url);
      return false;
    });
    renderEvents();
    renderClips();
    saveDraft();
  });

  els.exportCsv.addEventListener("click", exportCsv);
  els.exportProject.addEventListener("click", exportProject);
  els.chooseProjectFolder.addEventListener("click", chooseProjectFolder);
  els.saveProjectFolder.addEventListener("click", saveProjectToFolder);
  els.phaseSelect.addEventListener("change", saveDraft);

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
      return;
    }
    const key = event.key.toLowerCase();
    if (state.isSlotInputMode) {
      if (/^\d$/.test(key)) {
        event.preventDefault();
        state.slotInputBuffer = `${state.slotInputBuffer}${key}`.slice(0, 3);
        renderKeyboardPlayer();
        return;
      }
      if (key === "backspace") {
        event.preventDefault();
        state.slotInputBuffer = state.slotInputBuffer.slice(0, -1);
        renderKeyboardPlayer();
        return;
      }
      if (key === "enter") {
        event.preventDefault();
        confirmSlotInput();
        return;
      }
      if (key === "escape") {
        event.preventDefault();
        state.isSlotInputMode = false;
        state.slotInputBuffer = "";
        renderKeyboardPlayer();
        return;
      }
    }
    if (key === "n") {
      event.preventDefault();
      state.isSlotInputMode = true;
      state.slotInputBuffer = "";
      renderKeyboardPlayer();
      return;
    }
    if (/^[1-5]$/.test(key)) {
      event.preventDefault();
      selectLineupSlot(Number(key) - 1);
      return;
    }
    if (key === "tab") {
      event.preventDefault();
      state.keyboardTeam = state.keyboardTeam === "home" ? "away" : "home";
      state.isSlotInputMode = false;
      state.slotInputBuffer = "";
      renderAllPlayers();
      return;
    }
    if (key === "backspace") {
      event.preventDefault();
      if (!state.events.length) return;
      const [eventItem] = state.events.splice(0, 1);
      state.clips = state.clips.filter((clip) => {
        if (clip.eventId !== eventItem.id) return true;
        URL.revokeObjectURL(clip.url);
        return false;
      });
      renderEvents();
      renderClips();
      saveDraft();
      return;
    }
    if (key === "z" || event.key === "ArrowLeft") {
      event.preventDefault();
      state.selectedResult = "正面";
      renderTags();
      return;
    }
    if (key === "x" || event.key === "ArrowRight") {
      event.preventDefault();
      state.selectedResult = "问题";
      renderTags();
      return;
    }
    const tag = tagDefinitions.find((item) => item.positiveKey === key);
    if (!tag) return;
    event.preventDefault();
    addEvent(tag.name, state.selectedResult);
  });
}

function tick() {
  els.timeReadout.textContent = formatSeconds(currentSeconds());
  requestAnimationFrame(tick);
}

function init() {
  renderTags();
  const restored = loadDraft();
  if (!restored) {
    state.players.home = parseNumbers(els.homeNumbers.value);
    state.players.away = parseNumbers(els.awayNumbers.value);
  }
  renderAllPlayers();
  renderEvents();
  renderClips();
  bindEvents();
  loadDevices().catch(() => {
    els.deviceSelect.innerHTML = '<option value="">读取设备失败</option>';
  });
  if (!supportsProjectFolder()) {
    setStatus(els.projectStatus, "当前浏览器不支持直接保存文件夹", "hot");
  }
  tick();
}

init();
