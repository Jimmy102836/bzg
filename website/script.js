// 全局状态
const state = {
    connected: false,
    serverUrl: '',
    gpuInfo: null,
    selectedFile: null,
    processing: false,
    taskId: null,
    progress: 0,
    results: null,
    recentUrls: [],
    batchFiles: [],
    processingPaused: false,
    editMode: false,
    editingResults: null,
    presets: {},
    currentPreset: null,
    history: [],
    modalCallback: null,
    currentTaskId: null,
    processingActive: false
};

// DOM 元素对象
const elements = {
    // 连接相关元素
    serverUrl: document.getElementById('server-url'),
    connectionStatus: document.getElementById('connection-status'),
    connectBtn: document.getElementById('connect-btn'),
    disconnectBtn: document.getElementById('disconnect-btn'),
    recentUrls: document.getElementById('recent-urls'),
    urlButtons: document.getElementById('url-buttons'),
    gpuInfo: document.getElementById('gpu-info'),
    
    // 文件和处理相关元素
    fileInput: document.getElementById('audio-file'),
    fileInfo: document.getElementById('file-info'),
    outputFolder: document.getElementById('output-folder'),
    processBtn: document.getElementById('process-btn'),
    processingCard: document.getElementById('processing-card'),
    processingStatus: document.getElementById('processing-status'),
    progressBar: document.getElementById('progress-bar'),
    progressText: document.getElementById('progress-text'),
    detailedStatus: document.getElementById('detailed-status'),
    cancelBtn: document.getElementById('cancel-btn'),
    
    // 批量处理相关元素
    batchFilesInput: document.getElementById('batch-files'),
    batchFolder: document.getElementById('batch-folder'),
    batchOutputFolder: document.getElementById('batch-output-folder'),
    batchFilesList: document.getElementById('batch-files-list'),
    clearBatchBtn: document.getElementById('clear-batch-btn'),
    batchProcessBtn: document.getElementById('batch-process-btn'),
    batchProgressCard: document.getElementById('batch-progress-card'),
    batchStatus: document.getElementById('batch-status'),
    processedCount: document.getElementById('processed-count'),
    totalCount: document.getElementById('total-count'),
    batchTotalProgressBar: document.getElementById('batch-total-progress-bar'),
    batchProgressText: document.getElementById('batch-progress-text'),
    currentFileName: document.getElementById('current-file-name'),
    batchCurrentProgressBar: document.getElementById('batch-current-progress-bar'),
    batchCurrentProgressText: document.getElementById('batch-current-progress-text'),
    batchPauseBtn: document.getElementById('batch-pause-btn'),
    batchResumeBtn: document.getElementById('batch-resume-btn'),
    batchCancelBtn: document.getElementById('batch-cancel-btn'),
    
    // 结果相关元素
    resultsCard: document.getElementById('results-card'),
    resultsFileName: document.getElementById('results-file-name'),
    resultsDuration: document.getElementById('results-duration'),
    resultsSegments: document.getElementById('results-segments'),
    resultsSettings: document.getElementById('results-settings'),
    downloadAllBtn: document.getElementById('download-all-btn'),
    segmentsList: document.getElementById('segments-list'),
    
    // 编辑相关元素
    editSegmentsList: document.getElementById('edit-segments-list'),
    
    // 历史记录相关元素
    historyList: document.getElementById('history-list'),
    clearHistoryBtn: document.getElementById('clear-history-btn'),
    
    // 其他元素
    waveformContainer: document.getElementById('waveform-container'),
    currentFileProgressBar: document.getElementById('current-file-progress-bar'),
    editContent: document.getElementById('edit-content'),
    noEditContent: document.getElementById('no-edit-content'),
    editSegmentList: document.getElementById('edit-segment-list'),
    waveformContainer: document.getElementById('waveform-container'),
    historyList: document.getElementById('history-list'),
    modelProgressBar: document.getElementById('model-progress-bar'),
    analyzeProgressBar: document.getElementById('analyze-progress-bar'),
    segmentProgressBar: document.getElementById('segment-progress-bar'),
    detailedProgress: document.getElementById('detailed-progress'),
    mainAudioPlayer: document.getElementById('main-audio-player'),
    totalDuration: document.getElementById('total-duration'),
    modelUsed: document.getElementById('model-used'),
    presetSelect: document.getElementById('preset-select'),
    presetName: document.getElementById('preset-name'),
    modalOverlay: document.getElementById('modal-overlay'),
    modalTitle: document.getElementById('modal-title'),
    modalContent: document.getElementById('modal-content'),
    modalConfirm: document.getElementById('modal-confirm'),
    segmentFilter: document.getElementById('segment-filter'),
    segmentProgressBar: document.getElementById('segment-progress-bar'),
    processedCount: document.getElementById('processed-count'),
    totalCount: document.getElementById('total-count'),
    currentFileName: document.getElementById('current-file-name'),
    currentFileProgressBar: document.getElementById('current-file-progress-bar'),
    batchPauseBtn: document.getElementById('batch-pause-btn'),
    batchResumeBtn: document.getElementById('batch-resume-btn'),
    editContent: document.getElementById('edit-content'),
    noEditContent: document.getElementById('no-edit-content'),
    editSegmentList: document.getElementById('edit-segment-list'),
    waveformContainer: document.getElementById('waveform-container'),
    historyList: document.getElementById('history-list'),
    modelProgressBar: document.getElementById('model-progress-bar'),
    analyzeProgressBar: document.getElementById('analyze-progress-bar'),
    segmentProgressBar: document.getElementById('segment-progress-bar'),
    detailedProgress: document.getElementById('detailed-progress'),
    mainAudioPlayer: document.getElementById('main-audio-player'),
    totalDuration: document.getElementById('total-duration'),
    modelUsed: document.getElementById('model-used'),
    presetSelect: document.getElementById('preset-select'),
    presetName: document.getElementById('preset-name'),
    modalOverlay: document.getElementById('modal-overlay'),
    modalTitle: document.getElementById('modal-title'),
    modalContent: document.getElementById('modal-content'),
    modalConfirm: document.getElementById('modal-confirm'),
    segmentFilter: document.getElementById('segment-filter'),
    detailedStatus: document.getElementById('detailed-status')
};

// 加载最近的URL
function loadRecentUrls() {
    const savedUrls = localStorage.getItem('recentComputeUrls');
    if (savedUrls) {
        try {
            state.recentUrls = JSON.parse(savedUrls);
            if (state.recentUrls.length > 0) {
                elements.recentUrls.classList.remove('hidden');
                updateRecentUrlButtons();
            }
        } catch (e) {
            console.error('Failed to parse saved URLs', e);
        }
    }
}

// 加载预设
function loadPresets() {
    const savedPresets = localStorage.getItem('audioProcessorPresets');
    if (savedPresets) {
        try {
            state.presets = JSON.parse(savedPresets);
            updatePresetSelect();
        } catch (e) {
            console.error('Failed to parse saved presets', e);
        }
    }
}

// 加载历史记录
function loadHistory() {
    const savedHistory = localStorage.getItem('audioProcessingHistory');
    if (savedHistory) {
        try {
            state.history = JSON.parse(savedHistory);
            updateHistoryList();
        } catch (e) {
            console.error('Failed to parse history', e);
        }
    }
}

// 更新最近URL按钮
function updateRecentUrlButtons() {
    elements.urlButtons.innerHTML = '';
    state.recentUrls.forEach(url => {
        const button = document.createElement('button');
        button.className = 'url-button';
        button.textContent = url;
        button.onclick = () => {
            elements.serverUrl.value = url;
            connectToService();
        };
        elements.urlButtons.appendChild(button);
    });
}

// 更新预设选择下拉框
function updatePresetSelect() {
    // 保留默认选项
    elements.presetSelect.innerHTML = '<option value="">-- 选择预设 --</option><option value="default">默认设置</option>';
    
    // 添加自定义预设
    Object.keys(state.presets).forEach(presetName => {
        const option = document.createElement('option');
        option.value = presetName;
        option.textContent = presetName;
        elements.presetSelect.appendChild(option);
    });
}

// 保存URL
function saveUrl(url) {
    if (!url) return;
    
    const updatedUrls = [url, ...state.recentUrls.filter(u => u !== url)].slice(0, 5);
    state.recentUrls = updatedUrls;
    localStorage.setItem('recentComputeUrls', JSON.stringify(updatedUrls));
    
    if (updatedUrls.length > 0) {
        elements.recentUrls.classList.remove('hidden');
        updateRecentUrlButtons();
    }
}

// 连接到服务
function connectToService() {
    const serverUrl = document.getElementById('server-url').value.trim();
    
    if (!serverUrl) {
        showModal('连接错误', '请输入服务器地址');
        return;
    }
    
    const urlPattern = /^(https?:\/\/)?([a-zA-Z0-9.-]+)(:[0-9]+)?$/;
    if (!urlPattern.test(serverUrl)) {
        showModal('连接错误', '无效的服务器地址格式，请使用正确的地址格式，例如：localhost:9000');
        return;
    }
    
    // 更新 UI 状态
    elements.connectBtn.disabled = true;
    elements.connectionStatus.textContent = '正在连接...';
    elements.connectionStatus.className = 'status status-warning';
    
    // 构建完整的 API URL
    const apiUrl = serverUrl.startsWith('http') ? serverUrl : `http://${serverUrl}`;
    
    // 测试连接
    fetch(`${apiUrl}/api/status`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`服务器返回错误: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('服务连接成功:', data);
            
            // 更新状态
            state.connected = true;
            state.serverUrl = apiUrl;
            
            // 保存URL到最近使用
            saveUrl(serverUrl);
            
            // 更新 UI
            elements.connectionStatus.textContent = '已连接到本地算力服务';
            elements.connectionStatus.className = 'status status-connected';
            elements.connectBtn.classList.add('hidden');
            elements.disconnectBtn.classList.remove('hidden');
            updateProcessButton();
            updateBatchButtons();
            
            // 显示 GPU 信息
            updateGpuInfo(data.gpu_info);
            
            // 获取默认输出目录路径
            getDefaultOutputPath();
        })
        .catch(error => {
            console.error('连接失败:', error);
            
            // 更新 UI
            elements.connectBtn.disabled = false;
            elements.connectionStatus.textContent = '连接失败: ' + error.message;
            elements.connectionStatus.className = 'status status-disconnected';
            
            showModal('连接失败', `无法连接到服务器 ${serverUrl}。请确保服务已启动并且地址正确。<br>错误信息: ${error.message}`);
        });
}

// 获取默认输出目录
function getDefaultOutputPath() {
    if (!state.connected || !state.serverUrl) return;
    
    // 普通输出目录
    fetch(`${state.serverUrl}/api/get_default_output_dir`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                elements.outputFolder.value = data.path;
            }
        })
        .catch(error => {
            console.error('获取默认输出目录失败:', error);
        });
    
    // 批量输出目录
    fetch(`${state.serverUrl}/api/get_default_output_dir?isBatch=true`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                elements.batchOutputFolder.value = data.path;
            }
        })
        .catch(error => {
            console.error('获取默认批量输出目录失败:', error);
        });
}

// 断开服务连接
function disconnectService() {
    // 更新状态
    state.connected = false;
    state.serverUrl = null;
    
    // 更新 UI
    elements.connectionStatus.textContent = '未连接到本地算力服务';
    elements.connectionStatus.className = 'status status-disconnected';
    elements.connectBtn.classList.remove('hidden');
    elements.disconnectBtn.classList.add('hidden');
    elements.gpuInfo.classList.add('hidden');
    
    // 禁用处理按钮
    updateProcessButton();
    updateBatchButtons();
}

// 更新 GPU 信息
function updateGpuInfo(gpuInfo) {
    if (!gpuInfo || !gpuInfo.available) {
        elements.gpuInfo.innerHTML = `
            <div class="status status-warning">未检测到可用GPU，处理速度可能较慢</div>
        `;
        elements.gpuInfo.classList.remove('hidden');
        return;
    }
    
    const totalMemoryGB = (gpuInfo.total_memory / 1024).toFixed(1);
    const freeMemoryGB = (gpuInfo.free_memory / 1024).toFixed(1);
    const usedMemoryGB = ((gpuInfo.total_memory - gpuInfo.free_memory) / 1024).toFixed(1);
    
    elements.gpuInfo.innerHTML = `
        <div class="label">GPU 信息:</div>
        <div class="tag tag-primary">${gpuInfo.device_name}</div>
        <div class="tag tag-success">总显存: ${totalMemoryGB} GB</div>
        <div class="tag tag-info">可用: ${freeMemoryGB} GB</div>
        <div class="tag tag-warning">已用: ${usedMemoryGB} GB</div>
    `;
    elements.gpuInfo.classList.remove('hidden');
}

// 根据分段策略更新UI
function updateSegmentStrategyUI() {
    // 固定使用时间间隔策略
    document.getElementById('time-settings').classList.remove('hidden');
}

// 更新范围值
function updateRangeValue(inputId, valueId) {
    const input = document.getElementById(inputId);
    const valueSpan = document.getElementById(valueId);
    if (input && valueSpan) {
        valueSpan.textContent = input.value;
    }
}

// 处理文件选择
function handleFileSelect() {
    const file = elements.fileInput.files[0];
    if (!file) {
        state.selectedFile = null;
        elements.fileInfo.classList.add('hidden');
        updateProcessButton();
        return;
    }
    
    state.selectedFile = file;
    
    // 显示文件信息
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    elements.fileInfo.textContent = `选中文件: ${file.name} (${fileSizeMB} MB)`;
    elements.fileInfo.classList.remove('hidden');
    
    // 更新处理按钮状态
    updateProcessButton();
}

// 处理批量文件选择
function handleBatchFileSelect() {
    const files = elements.batchFilesInput.files;
    if (!files || files.length === 0) {
        return;
    }
    
    // 清空现有列表
    state.batchFiles = [];
    
    // 添加选中的文件
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        state.batchFiles.push(file);
    }
    
    // 更新UI
    updateBatchFilesList();
    updateBatchButtons();
}

// 更新批量文件列表
function updateBatchFilesList() {
    elements.batchFilesList.innerHTML = '';
    
    if (state.batchFiles.length === 0) {
        elements.batchFilesList.innerHTML = '<div class="empty-list-message">尚未选择文件</div>';
        return;
    }
    
    state.batchFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'batch-file-item';
        
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        
        fileItem.innerHTML = `
            <span class="file-name">${file.name}</span>
            <span class="file-size">${fileSizeMB} MB</span>
            <button onclick="removeBatchFile(${index})" class="btn-danger">移除</button>
        `;
        
        elements.batchFilesList.appendChild(fileItem);
    });
}

// 移除批量文件
function removeBatchFile(index) {
    if (index >= 0 && index < state.batchFiles.length) {
        state.batchFiles.splice(index, 1);
        updateBatchFilesList();
        updateBatchButtons();
    }
}

// 清空批量文件列表
function clearBatchFiles() {
    state.batchFiles = [];
    elements.batchFilesInput.value = '';
    elements.batchFolder.value = '';
    updateBatchFilesList();
    updateBatchButtons();
}

// 更新批量处理按钮状态
function updateBatchButtons() {
    const hasFiles = state.batchFiles.length > 0;
    elements.clearBatchBtn.disabled = !hasFiles;
    elements.batchProcessBtn.disabled = !hasFiles || !state.connected;
}

// 更新处理按钮状态
function updateProcessButton() {
    elements.processBtn.disabled = !(state.connected && state.selectedFile);
}

// 选择输出文件夹
function selectOutputFolder() {
    // 使用模态窗口让用户输入完整路径
    showModal('选择输出文件夹', `
        <p>请输入完整的输出文件夹路径:</p>
        <input type="text" id="folder-path-input" style="width: 100%; padding: 8px; margin-top: 10px;" 
               placeholder="例如: D:\\我的音频\\输出" value="${elements.outputFolder.value || ''}">
        <p class="hint">输入您希望保存处理结果的完整文件夹路径</p>
    `, () => {
        const folderPath = document.getElementById('folder-path-input').value.trim();
        if (folderPath) {
            elements.outputFolder.value = folderPath;
            setOutputFolder();
        }
    });
}

// 选择批量输出文件夹
function selectBatchOutputFolder() {
    // 使用模态窗口让用户输入完整路径
    showModal('选择批量输出文件夹', `
        <p>请输入完整的批量输出文件夹路径:</p>
        <input type="text" id="batch-folder-path-input" style="width: 100%; padding: 8px; margin-top: 10px;" 
               placeholder="例如: D:\\我的音频\\批量输出" value="${elements.batchOutputFolder.value || ''}">
        <p class="hint">输入您希望保存批量处理结果的完整文件夹路径</p>
    `, () => {
        const folderPath = document.getElementById('batch-folder-path-input').value.trim();
        if (folderPath) {
            elements.batchOutputFolder.value = folderPath;
            setBatchOutputFolder();
        }
    });
}

// 选择批量输入文件夹
function selectBatchFolder() {
    // 使用模态窗口让用户输入完整路径
    showModal('选择批量输入文件夹', `
        <p>请输入包含音频文件的文件夹路径:</p>
        <input type="text" id="batch-input-folder-path" style="width: 100%; padding: 8px; margin-top: 10px;" 
               placeholder="例如: D:\\我的音频文件夹">
        <p class="hint">输入包含您要处理的音频文件的完整文件夹路径</p>
    `, () => {
        const folderPath = document.getElementById('batch-input-folder-path').value.trim();
        if (!folderPath) return;
        
        elements.batchFolder.value = folderPath;
        
        // 向服务器请求文件夹内的文件信息
        if (state.connected && state.serverUrl) {
            // 显示状态信息
            elements.batchFolder.nextElementSibling.textContent = '获取中...';
            elements.batchFolder.nextElementSibling.disabled = true;
            
            fetch(`${state.serverUrl}/api/list_directory`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ path: folderPath })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`服务器返回错误: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // 处理返回的文件列表
                    const audioFiles = data.files.filter(
                        file => /\.(mp3|wav|ogg|flac|aac|m4a|mp4|avi|mov|wmv|mkv)$/i.test(file.name)
                    );
                    
                    if (audioFiles.length > 0) {
                        // 更新批量文件列表
                        state.batchFiles = audioFiles;
                        updateBatchFilesList();
                        updateBatchButtons();
                    } else {
                        showModal('提示', '所选文件夹中没有发现支持的音频或视频文件');
                    }
                } else {
                    showModal('错误', `获取文件列表失败: ${data.error || '未知错误'}`);
                }
            })
            .catch(error => {
                console.error('获取文件列表失败:', error);
                showModal('错误', `获取文件列表失败: ${error.message}`);
            })
            .finally(() => {
                elements.batchFolder.nextElementSibling.textContent = '选择...';
                elements.batchFolder.nextElementSibling.disabled = false;
            });
        }
    });
}

// 设置输出文件夹
function setOutputFolder() {
    let folderPath = elements.outputFolder.value.trim();
    
    // 检查是否已连接到服务
    if (!state.connected || !state.serverUrl) {
        showModal('错误', '请先连接到本地算力服务');
        return;
    }
    
    // 如果未指定路径，使用默认路径
    const useDefaultPath = !folderPath;
    
    // 显示状态信息
    const oldBtnText = elements.outputFolder.nextElementSibling.nextElementSibling.textContent;
    elements.outputFolder.nextElementSibling.nextElementSibling.textContent = '设置中...';
    elements.outputFolder.nextElementSibling.nextElementSibling.disabled = true;
    
    // 发送到服务器
    fetch(`${state.serverUrl}/api/set_output_dir`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            path: folderPath,
            useDefault: useDefaultPath
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`服务器返回错误: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // 更新显示的路径
            elements.outputFolder.value = data.path;
            showModal('成功', `输出文件夹已设置为: ${data.path}`);
        } else {
            showModal('错误', `设置输出文件夹失败: ${data.error || '未知错误'}`);
        }
    })
    .catch(error => {
        console.error('设置输出文件夹失败:', error);
        showModal('错误', `设置输出文件夹失败: ${error.message}`);
    })
    .finally(() => {
        // 恢复按钮状态
        elements.outputFolder.nextElementSibling.nextElementSibling.textContent = oldBtnText;
        elements.outputFolder.nextElementSibling.nextElementSibling.disabled = false;
    });
}

// 设置批量输出文件夹
function setBatchOutputFolder() {
    let folderPath = elements.batchOutputFolder.value.trim();
    
    // 检查是否已连接到服务
    if (!state.connected || !state.serverUrl) {
        showModal('错误', '请先连接到本地算力服务');
        return;
    }
    
    // 如果未指定路径，使用默认路径
    const useDefaultPath = !folderPath;
    
    // 显示状态信息
    const oldBtnText = elements.batchOutputFolder.nextElementSibling.nextElementSibling.textContent;
    elements.batchOutputFolder.nextElementSibling.nextElementSibling.textContent = '设置中...';
    elements.batchOutputFolder.nextElementSibling.nextElementSibling.disabled = true;
    
    // 发送到服务器
    fetch(`${state.serverUrl}/api/set_output_dir`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            path: folderPath, 
            isBatch: true,
            useDefault: useDefaultPath
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`服务器返回错误: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // 更新显示的路径
            elements.batchOutputFolder.value = data.path;
            showModal('成功', `批量输出文件夹已设置为: ${data.path}`);
        } else {
            showModal('错误', `设置批量输出文件夹失败: ${data.error || '未知错误'}`);
        }
    })
    .catch(error => {
        console.error('设置批量输出文件夹失败:', error);
        showModal('错误', `设置批量输出文件夹失败: ${error.message}`);
    })
    .finally(() => {
        // 恢复按钮状态
        elements.batchOutputFolder.nextElementSibling.nextElementSibling.textContent = oldBtnText;
        elements.batchOutputFolder.nextElementSibling.nextElementSibling.disabled = false;
    });
}

// 显示模态对话框
function showModal(title, content, callback = null) {
    elements.modalTitle.textContent = title;
    elements.modalContent.innerHTML = content;
    elements.modalOverlay.classList.remove('hidden');
    state.modalCallback = callback;
}

// 关闭模态对话框
function closeModal() {
    elements.modalOverlay.classList.add('hidden');
    state.modalCallback = null;
}

// 确认模态对话框
function confirmModal() {
    if (state.modalCallback) {
        state.modalCallback();
    }
    closeModal();
}

// 开始处理
function startProcessing() {
    if (!state.connected || !state.selectedFile) return;
    
    // 获取处理参数
    const model = document.getElementById('model-select').value;
    const language = "zh"; // 固定使用中文
    const strategy = 'time'; // 固定使用时间间隔策略
    
    // 获取关键词
    const keywordsText = document.getElementById('keywords').value.trim();
    // 按照 desktop_app.py 的实现方式处理关键词
    const keywords_normalized = keywordsText.replace(/[,;，；]/g, ' ');
    const keywords = keywords_normalized ? keywords_normalized.split(' ').filter(kw => kw.trim().length > 0) : [];
    
    // 准备上传的表单数据
    const formData = new FormData();
    formData.append('file', state.selectedFile);
    
    // 准备处理参数
    const processingParams = {
        model: `whisper-${model}`,
        minInterval: parseFloat(document.getElementById('min-interval').value),
        maxInterval: parseFloat(document.getElementById('max-interval').value),
        preserveSentences: document.getElementById('preserve-sentences').checked,
        audioFormat: document.getElementById('audio-format').value,
        keywords: keywords.join(' '),
        prefix: 'segment'
    };
    
    // 将参数作为 JSON 添加到表单
    formData.append('data', JSON.stringify(processingParams));
    
    // 更新界面状态
    elements.processBtn.disabled = true;
    elements.processingCard.classList.remove('hidden');
    elements.processingStatus.textContent = '准备处理...';
    elements.progressBar.style.width = '0%';
    elements.progressText.textContent = '0%';
    
    // 发送请求到服务器
    fetch(`${state.serverUrl}/api/upload`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`上传失败: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('处理任务已开始:', data);
        
        if (data.task_id) {
            // 保存任务ID，用于轮询状态
            state.currentTaskId = data.task_id;
            state.processingActive = true;
            
            // 开始轮询任务状态
            pollTaskStatus(data.task_id);
        } else {
            throw new Error('未收到有效的任务ID');
        }
    })
    .catch(error => {
        console.error('上传处理失败:', error);
        elements.processingStatus.textContent = `处理失败: ${error.message}`;
        elements.processBtn.disabled = false;
        showModal('处理失败', `无法开始处理任务。<br>错误信息: ${error.message}`);
    });
}

// 轮询任务状态
function pollTaskStatus(taskId) {
    if (!state.processingActive) return;
    
    fetch(`${state.serverUrl}/api/tasks/${taskId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`获取状态失败: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // 更新进度和状态
            updateProgress(data.progress, data.status);
            
            // 更新详细状态
            if (data.detailed_status) {
                updateDetailedStatus(data.detailed_status);
            }
            
            // 检查任务是否完成
            if (data.completed) {
                state.processingActive = false;
                // 处理完成
                completeProcessing(data.result);
            } else if (data.error) {
                // 处理错误
                state.processingActive = false;
                elements.processingStatus.textContent = `处理失败: ${data.error}`;
                elements.processBtn.disabled = false;
                showModal('处理失败', `处理任务失败。<br>错误信息: ${data.error}`);
            } else {
                // 继续轮询
                setTimeout(() => pollTaskStatus(taskId), 1000);
            }
        })
        .catch(error => {
            console.error('轮询任务状态失败:', error);
            elements.processingStatus.textContent = `状态查询失败: ${error.message}`;
            // 继续尝试轮询
            setTimeout(() => pollTaskStatus(taskId), 2000);
        });
}

// 更新处理详细状态
function updateDetailedStatus(message) {
    elements.detailedStatus.textContent = message;
}

// 完成处理
function completeProcessing(result) {
    // 更新UI
    elements.progressBar.style.width = '100%';
    elements.progressText.textContent = '100%';
    elements.processingStatus.textContent = '处理完成！';
    elements.processBtn.disabled = false;
    
    // 构建结果对象
    const completionTimestamp = Date.now();
    const results = {
        fileName: state.selectedFile.name,
        fileSize: state.selectedFile.size,
        outputFiles: result.output_files || [],
        segments: result.segments || [],
        timestamp: completionTimestamp,
        settings: {
            model: document.getElementById('model-select').value,
            strategy: '按时间间隔',
            minInterval: parseFloat(document.getElementById('min-interval').value),
            maxInterval: parseFloat(document.getElementById('max-interval').value),
            outputFormat: document.getElementById('audio-format').value
        },
        outputDir: result.output_dir || ''
    };
    
    // 显示结果
    displayResults(results);
    
    // 保存到历史记录
    saveToHistory(results);
    
    // 切换到结果标签页
    switchTab('results');
}

// 更新进度
function updateProgress(percent, message) {
    state.progress = percent;
    elements.progressBar.style.width = `${percent}%`;
    elements.progressText.textContent = `${percent}%` + (message ? ` - ${message}` : '');
    elements.processingStatus.textContent = message || '处理中...';
}

// 更新标签页
function switchTab(tabId) {
    // 获取所有标签和内容
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');
    
    // 移除所有活动状态
    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));
    
    // 激活选中的标签
    document.querySelector(`.tab[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(`${tabId}-tab`).classList.add('active');
}

// 切换到编辑标签页
function switchToEditTab() {
    switchTab('edit');
    
    // 如果当前没有编辑内容，使用当前结果初始化
    if (!state.editMode && state.results) {
        state.editMode = true;
        state.editingResults = JSON.parse(JSON.stringify(state.results)); // 深拷贝
        elements.noEditContent.classList.add('hidden');
        elements.editContent.classList.remove('hidden');
        
        // 初始化波形编辑器和分段列表
        updateEditSegmentList();
    }
}

// 显示结果
function displayResults(results) {
    // 获取结果标签页内容区域
    const resultsContent = document.getElementById('results-content');
    if (!resultsContent) return;
    
    // 清空现有内容
    resultsContent.innerHTML = '';
    
    // 创建结果卡片
    const resultCard = document.createElement('div');
    resultCard.className = 'card';
    resultCard.innerHTML = `
        <div class="card-header">处理结果: ${results.fileName}</div>
        <div class="card-body">
            <div class="results-info">
                <p>总时长: ${formatTime(results.duration)}</p>
                <p>片段数: ${results.segments.length}</p>
                <p>处理时间: ${new Date(results.timestamp).toLocaleString()}</p>
                <p>使用模型: ${results.settings.model}</p>
                <p>分段策略: ${results.settings.strategy}</p>
            </div>
            <div class="segments-container">
                <h3>转写结果</h3>
                <div class="segments-list">
                    ${results.segments.map(segment => `
                        <div class="segment-item">
                            <div class="segment-time">${formatTime(segment.start)} - ${formatTime(segment.end)}</div>
                            <div class="segment-text">${segment.text}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    resultsContent.appendChild(resultCard);
    
    // 显示结果内容，隐藏空状态
    document.getElementById('no-results').classList.add('hidden');
    resultsContent.classList.remove('hidden');
}

// 格式化时间显示
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
}

// 保存到历史记录
function saveToHistory(results) {
    const history = JSON.parse(localStorage.getItem('audioProcessingHistory') || '[]');
    
    // 添加到历史记录
    history.unshift({
        id: Date.now(),
        file: results.fileName,
        duration: results.duration,
        segments: results.segments.length,
        timestamp: results.timestamp,
        settings: results.settings
    });
    
    // 最多保存20条记录
    if (history.length > 20) {
        history.pop();
    }
    
    localStorage.setItem('audioProcessingHistory', JSON.stringify(history));
    
    // 更新历史记录显示
    updateHistoryList();
}

// 更新历史记录列表
function updateHistoryList() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;
    
    const history = JSON.parse(localStorage.getItem('audioProcessingHistory') || '[]');
    
    // 清空现有内容
    historyList.innerHTML = '';
    
    if (history.length === 0) {
        // 显示空状态
        historyList.innerHTML = `
            <div class="empty-state">
                <p>历史记录暂时为空</p>
                <p>您处理的音频将记录在这里</p>
            </div>
        `;
        return;
    }
    
    // 添加历史记录项
    history.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        const timestamp = new Date(item.timestamp).toLocaleString();
        const duration = formatTime(item.duration);
        
        historyItem.innerHTML = `
            <div class="history-item-header">
                <span class="file-name">${item.file}</span>
                <span class="date">${timestamp}</span>
            </div>
            <div class="history-item-details">
                时长: ${duration} | 片段数: ${item.segments} | 模型: ${item.settings.model}
            </div>
        `;
        
        historyList.appendChild(historyItem);
    });
}

// 更新编辑片段列表
function updateEditSegmentList() {
    const editSegmentList = document.getElementById('edit-segment-list');
    if (!editSegmentList || !state.editingResults) return;
    
    editSegmentList.innerHTML = '';
    
    state.editingResults.segments.forEach((segment, index) => {
        const segmentItem = document.createElement('div');
        segmentItem.className = 'edit-segment-item';
        segmentItem.innerHTML = `
            <div class="edit-segment-header">
                <span>片段 ${index + 1}: ${formatTime(segment.start)} - ${formatTime(segment.end)}</span>
            </div>
            <textarea class="edit-segment-text">${segment.text}</textarea>
        `;
        
        editSegmentList.appendChild(segmentItem);
    });
}

// 批量处理相关函数
function startBatchProcessing() {
    if (!state.connected || state.batchFiles.length === 0) return;
    
    // 获取处理参数
    const model = document.getElementById('model-select').value;
    const language = "zh"; // 固定使用中文
    const strategy = 'time'; // 固定使用时间间隔策略
    
    // 获取关键词
    const keywordsText = document.getElementById('keywords').value.trim();
    // 按照 desktop_app.py 的实现方式处理关键词
    const keywords_normalized = keywordsText.replace(/[,;，；]/g, ' ');
    const keywords = keywords_normalized ? keywords_normalized.split(' ').filter(kw => kw.trim().length > 0) : [];
    
    // 保存处理参数到状态中，供批量处理使用
    state.batchProcessingParams = {
        model: `whisper-${model}`,
        language: language,
        strategy: strategy,
        preserveSentences: document.getElementById('preserve-sentences').checked,
        audioFormat: document.getElementById('audio-format').value,
        keywords: keywords.join(' '), // 添加关键词参数
        minInterval: parseFloat(document.getElementById('min-interval').value),
        maxInterval: parseFloat(document.getElementById('max-interval').value),
        prefix: 'segment'
    };
    
    // 显示批量处理卡片
    elements.batchProgressCard.classList.remove('hidden');
    elements.batchStatus.textContent = '准备处理...';
    
    // 更新状态
    const totalFiles = state.batchFiles.length;
    document.getElementById('total-count').textContent = totalFiles;
    document.getElementById('processed-count').textContent = '0';
    document.getElementById('batch-progress-text').textContent = '0%';
    document.getElementById('current-file-name').textContent = '当前文件: 无';
    
    // 更新进度条
    document.getElementById('batch-total-progress-bar').style.width = '0%';
    document.getElementById('current-file-progress-bar').style.width = '0%';
    
    // 禁用处理按钮
    elements.batchProcessBtn.disabled = true;
    
    // 实际批量处理
    state.batchProcessing = true;
    state.batchProcessingPaused = false;
    state.currentBatchIndex = 0;
    state.processedBatchFiles = 0;
    state.batchTasks = [];
    
    // 向服务器发送批量处理请求
    if (elements.batchFolder.value.trim()) {
        // 使用文件夹路径批量处理
        startBatchProcessingWithFolder();
    } else {
        // 处理第一个文件
        processBatchFile();
    }
}

// 使用文件夹路径进行批量处理
function startBatchProcessingWithFolder() {
    const folderPath = elements.batchFolder.value.trim();
    if (!folderPath) return;
    
    const batchOutputFolder = elements.batchOutputFolder.value.trim();
    
    // 准备请求数据
    const requestData = {
        path: folderPath,
        output_dir: batchOutputFolder,
        params: state.batchProcessingParams
    };
    
    // 发送批量处理请求
    fetch(`${state.serverUrl}/api/batch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`服务器返回错误: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.batch_id) {
            state.batchId = data.batch_id;
            state.batchTasks = data.task_ids || [];
            
            // 开始轮询批量处理状态
            pollBatchStatus(data.batch_id);
        } else {
            throw new Error('未收到有效的批量任务ID');
        }
    })
    .catch(error => {
        console.error('批量处理请求失败:', error);
        elements.batchStatus.textContent = `批量处理失败: ${error.message}`;
        elements.batchProcessBtn.disabled = false;
        showModal('批量处理失败', `无法开始批量处理任务。<br>错误信息: ${error.message}`);
    });
}

// 处理批量文件中的一个
function processBatchFile() {
    if (!state.batchProcessing || state.batchProcessingPaused) return;
    
    if (state.currentBatchIndex >= state.batchFiles.length) {
        // 所有文件处理完毕
        completeBatchProcessing();
        return;
    }
    
    const file = state.batchFiles[state.currentBatchIndex];
    if (!file) {
        // 跳过无效文件
        state.currentBatchIndex++;
        processBatchFile();
        return;
    }
    
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    
    // 更新UI
    document.getElementById('current-file-name').textContent = `当前文件: ${file.name} (${fileSizeMB} MB)`;
    document.getElementById('current-file-progress-bar').style.width = '0%';
    
    // 显示当前使用的关键词
    let keywordsInfo = '';
    if (state.batchProcessingParams && state.batchProcessingParams.keywords) {
        const keywordsText = state.batchProcessingParams.keywords;
        if (keywordsText) {
            keywordsInfo = `根据关键词过滤片段`;
            elements.batchStatus.textContent = `处理中... ${keywordsInfo}`;
        } else {
            elements.batchStatus.textContent = '处理中...';
        }
    } else {
        elements.batchStatus.textContent = '处理中...';
    }
    
    // 准备上传的表单数据或从文件夹选择中进行处理
    if (file.file) {
        // 处理上传的文件（用户选择的批量文件）
        const formData = new FormData();
        formData.append('file', file.file);
        formData.append('data', JSON.stringify(state.batchProcessingParams));
        
        // 发送请求到服务器
        fetch(`${state.serverUrl}/api/upload`, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`上传失败: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('处理任务已开始:', data);
            
            if (data.task_id) {
                // 保存任务ID，用于轮询状态
                const taskId = data.task_id;
                
                // 轮询此文件的处理状态
                pollBatchFileStatus(taskId, () => {
                    // 当前文件处理完成后的回调
                    state.processedBatchFiles++;
                    state.currentBatchIndex++;
                    
                    // 更新总进度
                    const totalProgress = Math.floor((state.processedBatchFiles / state.batchFiles.length) * 100);
                    document.getElementById('batch-total-progress-bar').style.width = `${totalProgress}%`;
                    document.getElementById('batch-progress-text').textContent = `${totalProgress}%`;
                    document.getElementById('processed-count').textContent = state.processedBatchFiles;
                    
                    // 处理下一个文件
                    setTimeout(() => {
                        processBatchFile();
                    }, 500);
                });
            } else {
                throw new Error('未收到有效的任务ID');
            }
        })
        .catch(error => {
            console.error('文件处理失败:', error);
            
            // 在出错的情况下也尝试继续处理下一个文件
            state.currentBatchIndex++;
            setTimeout(() => {
                processBatchFile();
            }, 500);
        });
    } else {
        // 处理服务器端的文件（文件夹选择返回的文件列表）
        const filePath = file.path;
        
        // 准备处理参数
        const processingParams = {
            ...state.batchProcessingParams,
            file_path: filePath
        };
        
        // 发送处理请求
        fetch(`${state.serverUrl}/api/process_file`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(processingParams)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`处理请求失败: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('处理任务已开始:', data);
            
            if (data.task_id) {
                // 保存任务ID，用于轮询状态
                const taskId = data.task_id;
                
                // 轮询此文件的处理状态
                pollBatchFileStatus(taskId, () => {
                    // 当前文件处理完成后的回调
                    state.processedBatchFiles++;
                    state.currentBatchIndex++;
                    
                    // 更新总进度
                    const totalProgress = Math.floor((state.processedBatchFiles / state.batchFiles.length) * 100);
                    document.getElementById('batch-total-progress-bar').style.width = `${totalProgress}%`;
                    document.getElementById('batch-progress-text').textContent = `${totalProgress}%`;
                    document.getElementById('processed-count').textContent = state.processedBatchFiles;
                    
                    // 处理下一个文件
                    setTimeout(() => {
                        processBatchFile();
                    }, 500);
                });
            } else {
                throw new Error('未收到有效的任务ID');
            }
        })
        .catch(error => {
            console.error('文件处理失败:', error);
            
            // 在出错的情况下也尝试继续处理下一个文件
            state.currentBatchIndex++;
            setTimeout(() => {
                processBatchFile();
            }, 500);
        });
    }
}

// 轮询批量文件处理状态
function pollBatchFileStatus(taskId, onComplete) {
    if (!state.batchProcessing || state.batchProcessingPaused) return;
    
    fetch(`${state.serverUrl}/api/tasks/${taskId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`获取状态失败: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // 更新当前文件进度
            document.getElementById('current-file-progress-bar').style.width = `${data.progress}%`;
            
            // 显示详细状态
            if (data.detailed_status) {
                elements.batchStatus.textContent = data.detailed_status;
            }
            
            // 检查任务是否完成
            if (data.completed) {
                if (onComplete) onComplete();
            } else if (data.error) {
                console.error('文件处理错误:', data.error);
                if (onComplete) onComplete();
            } else {
                // 继续轮询
                setTimeout(() => pollBatchFileStatus(taskId, onComplete), 1000);
            }
        })
        .catch(error => {
            console.error('轮询任务状态失败:', error);
            // 继续尝试轮询
            setTimeout(() => pollBatchFileStatus(taskId, onComplete), 2000);
        });
}

// 轮询批量处理状态
function pollBatchStatus(batchId) {
    if (!state.batchProcessing) return;
    
    fetch(`${state.serverUrl}/api/batch/${batchId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`获取批量状态失败: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // 更新总进度
            document.getElementById('batch-total-progress-bar').style.width = `${data.total_progress}%`;
            document.getElementById('batch-progress-text').textContent = `${data.total_progress}%`;
            document.getElementById('processed-count').textContent = data.completed_count;
            document.getElementById('total-count').textContent = data.task_count;
            
            // 更新当前文件信息
            const currentTasks = Object.values(data.tasks).filter(t => !t.completed && !t.error);
            if (currentTasks.length > 0) {
                const currentTask = currentTasks[0];
                elements.batchStatus.textContent = currentTask.status;
                
                // 更新当前文件进度条
                document.getElementById('current-file-progress-bar').style.width = `${currentTask.progress}%`;
                
                // 提取当前文件名称
                let fileName = "正在处理...";
                if (currentTask.detailed_status && currentTask.detailed_status.includes(':')) {
                    const match = currentTask.detailed_status.match(/: (.+?)( \(|$)/);
                    if (match && match[1]) {
                        fileName = match[1];
                    }
                }
                document.getElementById('current-file-name').textContent = `当前文件: ${fileName}`;
            }
            
            // 检查批量处理是否完成
            if (data.status === 'completed') {
                completeBatchProcessing();
            } else if (data.status === 'error') {
                // 处理出错但继续处理其他文件
                elements.batchStatus.textContent = '部分文件处理出错，继续处理其他文件...';
                setTimeout(() => pollBatchStatus(batchId), 1000);
            } else {
                // 继续轮询
                setTimeout(() => pollBatchStatus(batchId), 1000);
            }
        })
        .catch(error => {
            console.error('轮询批量状态失败:', error);
            // 继续尝试轮询
            setTimeout(() => pollBatchStatus(batchId), 2000);
        });
}

// 完成批量处理
function completeBatchProcessing() {
    elements.batchStatus.textContent = '所有文件处理完成';
    document.getElementById('batch-progress-text').textContent = '100%';
    document.getElementById('batch-total-progress-bar').style.width = '100%';
    
    // 更新UI
    elements.batchProcessBtn.disabled = false;
    
    // 显示模态对话框
    showModal('批量处理完成', `已完成 ${state.processedBatchFiles} 个文件的处理。`, () => {
        // 重置状态
        state.batchProcessing = false;
        elements.batchProgressCard.classList.add('hidden');
    });
}

// 暂停批量处理
function pauseBatchProcessing() {
    state.batchProcessingPaused = true;
    document.getElementById('batch-pause-btn').classList.add('hidden');
    document.getElementById('batch-resume-btn').classList.remove('hidden');
}

// 继续批量处理
function resumeBatchProcessing() {
    state.batchProcessingPaused = false;
    document.getElementById('batch-pause-btn').classList.remove('hidden');
    document.getElementById('batch-resume-btn').classList.add('hidden');
    elements.batchStatus.textContent = '处理中...';
    
    // 继续处理
    processBatchFile();
}

// 取消批量处理
function cancelBatchProcessing() {
    if (!state.batchProcessing) return;
    
    showModal('确认取消', '确定要取消当前批量处理任务吗？', () => {
        state.batchProcessing = false;
        elements.batchProgressCard.classList.add('hidden');
        elements.batchProcessBtn.disabled = false;
        document.getElementById('batch-pause-btn').classList.remove('hidden');
        document.getElementById('batch-resume-btn').classList.add('hidden');
    });
}

// 取消处理
function cancelProcessing() {
    if (!state.processingActive || !state.currentTaskId) return;
    
    showModal('确认取消', '确定要取消当前处理任务吗？', () => {
        // 标记为不再轮询
        state.processingActive = false;
        
        // 更新UI状态
        elements.processingStatus.textContent = '处理已取消';
        elements.progressBar.style.width = '0%';
        elements.progressText.textContent = '0%';
        elements.processBtn.disabled = false;
        
        // 延迟隐藏处理卡片
        setTimeout(() => {
            elements.processingCard.classList.add('hidden');
        }, 1500);
    });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化标签页切换
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.getAttribute('data-tab'));
        });
    });
    
    // 加载保存的URL和预设
    loadRecentUrls();
    loadPresets();
    loadHistory();
    
    // 禁用处理按钮
    elements.processBtn.disabled = true;
    
    // 初始化分段策略UI
    updateSegmentStrategyUI();
});