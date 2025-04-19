import os
import sys
import time
import logging
import json
import threading
import torch
import tempfile
import psutil
import traceback
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename

# 导入来自 desktop_app.py 的关键组件
# 确保这些文件在同一目录或已添加到 Python 路径
try:
    from src.ai_analyzer import AudioAnalyzer
    from src.audio_processor import AudioProcessor
except ImportError:
    # 如果无法导入，尝试直接相对导入
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from ai_analyzer import AudioAnalyzer
    from audio_processor import AudioProcessor

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("local_service.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# 创建 Flask 应用
app = Flask(__name__)
# 启用跨域请求支持，允许所有来源
CORS(app, resources={r"/*": {"origins": "*"}})

# 全局状态
class ServiceState:
    def __init__(self):
        self.analyzer = None
        self.processing_tasks = {}
        self.output_dir = os.path.join(os.path.expanduser("~"), "Downloads", "音频处理结果")
        self.gpu_info = {
            "available": torch.cuda.is_available(),
            "device_count": torch.cuda.device_count() if torch.cuda.is_available() else 0,
            "device_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "N/A",
            "total_memory": 0,
            "free_memory": 0
        }
        self.update_gpu_info()
        # 确保输出目录存在
        os.makedirs(self.output_dir, exist_ok=True)
        
    def update_gpu_info(self):
        if torch.cuda.is_available():
            try:
                # 获取当前设备
                device = torch.cuda.current_device()
                # 获取总内存
                total_memory = torch.cuda.get_device_properties(device).total_memory / (1024 * 1024)  # MB
                # 获取已分配内存
                allocated_memory = torch.cuda.memory_allocated(device) / (1024 * 1024)  # MB
                # 计算可用内存
                free_memory = total_memory - allocated_memory
                
                self.gpu_info.update({
                    "total_memory": round(total_memory),
                    "free_memory": round(free_memory)
                })
            except Exception as e:
                logger.error(f"更新GPU信息失败: {str(e)}")

# 初始化服务状态
state = ServiceState()

# 处理任务类
class ProcessingTask(threading.Thread):
    def __init__(self, task_id, audio_path, model_name, min_interval, max_interval, 
                 preserve_sentences, keywords, output_settings, language="zh"):
        super().__init__()
        self.task_id = task_id
        self.audio_path = audio_path
        self.model_name = model_name
        self.min_interval = min_interval
        self.max_interval = max_interval
        self.preserve_sentences = preserve_sentences
        self.keywords = keywords
        self.output_settings = output_settings
        self.language = language
        self.status = "初始化"
        self.progress = 0
        self.detailed_status = "任务创建"
        self.output_files = []
        self.segments = []
        self.error = None
        self.start_time = None
        self.completed = False
        self.analyzer = None
        
    def update_status(self, status, progress=None, detailed=None):
        self.status = status
        if progress is not None:
            self.progress = progress
        if detailed:
            self.detailed_status = detailed
        logger.info(f"任务 {self.task_id} - {status} - 进度: {self.progress}% - {detailed if detailed else ''}")
    
    def run(self):
        try:
            # 记录开始时间
            self.start_time = time.time()
            
            # 创建临时目录
            temp_dir = tempfile.mkdtemp()
            self.update_status("创建临时工作目录", 1, "初始化处理环境...")
            
            # 初始化音频处理器
            max_cores = psutil.cpu_count(logical=False) or 4
            audio_processor = AudioProcessor(
                use_disk_processing=self.output_settings.get('use_disk_processing', True),
                chunk_size_mb=self.output_settings.get('chunk_size_mb', 200),
                max_workers=min(self.output_settings.get('max_workers', 2), max_cores)
            )
            
            # 进度回调函数
            def update_progress(message, percent):
                self.update_status(message, percent)
            
            # 检查输入文件类型
            file_ext = os.path.splitext(self.audio_path)[1].lower()
            is_video = file_ext in ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm', '.3gp', '.m4v']
            
            # 处理输入文件
            if is_video:
                self.update_status("检测到视频文件，准备转码...", 2, f"检测到视频文件: {os.path.basename(self.audio_path)}")
                
                # 视频转音频进度更新函数
                def video_progress(current_time, total_time, message=""):
                    if total_time <= 0:
                        percent = 3
                    else:
                        percent = 3 + (current_time / total_time) * 7
                    update_progress(f"视频转音频: {message}", int(percent))
                
                # 获取视频信息
                video_info = audio_processor.get_media_info(self.audio_path)
                
                # 开始视频转音频
                self.update_status("从视频中提取音频轨道...", 3)
                extracted_audio = audio_processor.convert_video_to_audio(
                    input_file=self.audio_path,
                    output_dir=temp_dir,
                    bitrate=self.output_settings.get('bitrate', '192k')
                )
                self.update_status("音频轨提取完成", 10, f"视频转音频完成: {os.path.basename(extracted_audio)}")
                
            else:
                # 处理音频文件
                self.update_status("处理音频文件...", 5, "处理音频文件...")
                
                # 获取音频信息
                audio_info = audio_processor.get_media_info(self.audio_path)
                
                # 提取/处理音频
                extracted_audio = audio_processor.extract_audio(
                    self.audio_path
                )
                self.update_status("音频处理完成", 15, f"音频处理完成: {os.path.basename(extracted_audio)}")
            
            # 加载AI模型
            try:
                if is_video:
                    self.update_status("加载AI模型...", 15, f"加载AI模型: {self.model_name}...")
                else:
                    self.update_status("加载AI模型...", 20, f"加载AI模型: {self.model_name}...")
                
                # 初始化前清理缓存
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                
                self.update_status("加载AI模型", 25, "正在下载/加载AI模型文件...")
                self.analyzer = AudioAnalyzer(model_name=self.model_name)
                
                # 转录音频 - 使用新方法
                self.update_status("AI分析音频内容...", 30, "开始音频转录...")
                # 直接调用方法，不再使用变量名
                transcription = self.analyzer.transcribe(
                    audio_path=extracted_audio,
                    chunk_length=10,
                    language=self.language if self.language != "自动检测" else None
                )
                
                # 显示转录结果统计
                segments_count = len(transcription.get("segments", []))
                self.update_status("音频转录完成", 45, f"音频分析完成，转录生成了 {segments_count} 个初始片段")
                
                # 查找句子断点 - 使用新方法
                self.update_status("寻找合理的断句点...", 50, 
                                  f"正在分析最佳断句位置: 最小间隔 {self.min_interval} 秒, 最大间隔 {self.max_interval} 秒")
                
                segments = self.analyzer.find_sentence_breaks(
                    transcription=transcription, 
                    max_interval=self.max_interval,
                    min_interval=self.min_interval,
                    preserve_sentences=self.preserve_sentences
                )
                
                # 显示分段结果统计
                if segments:
                    total_duration = sum(seg['end'] - seg['start'] for seg in segments)
                    avg_duration = total_duration / len(segments) if segments else 0
                    self.update_status("找到分段点", 55, 
                                     f"找到 {len(segments)} 个分段点，平均片段长度 {avg_duration:.1f} 秒")
                else:
                    self.update_status("未找到分段点", 55, "警告: 没有找到有效的分段点")
                
                # 过滤关键词 - 使用新方法
                filtered_segments = segments.copy()
                original_segments = segments.copy()
                
                if self.keywords:
                    try:
                        import re
                        keywords_normalized = re.sub(r'[,;，；]', ' ', self.keywords)
                        filter_keywords = [k.strip() for k in keywords_normalized.split() if k.strip()]
                        
                        if filter_keywords:
                            self.update_status(f"过滤含有关键词的片段...", 60, 
                                           f"根据关键词过滤片段: {', '.join(filter_keywords[:3])}{'...' if len(filter_keywords) > 3 else ''}")
                            
                            filtered_segments = self.analyzer.filter_segments_with_keywords(
                                segments=segments, 
                                keywords=filter_keywords
                            )
                            
                            removed = len(segments) - len(filtered_segments)
                            self.update_status("关键词过滤完成", 65, 
                                           f"关键词过滤完成，移除了 {removed} 个片段，剩余 {len(filtered_segments)} 个片段")
                    except Exception as e:
                        self.update_status("关键词过滤失败", 65, f"错误: 关键词过滤过程中出错 - {str(e)}")
                
                # 分割音频
                self.update_status("分割音频文件...", 70, f"准备将音频分割为 {len(filtered_segments)} 个独立文件...")
                
                # 显示输出配置
                output_format = self.output_settings.get('format', 'mp3')
                bitrate = self.output_settings.get('bitrate', '192k')
                self.update_status("准备分割", 75, f"输出格式: {output_format}, 音质比特率: {bitrate}")
                
                # 分割音频
                output_files = audio_processor.split_audio(
                    extracted_audio, 
                    filtered_segments,
                    output_dir=self.output_settings.get('output_dir', state.output_dir),
                    file_prefix=self.output_settings.get('prefix', 'segment'),
                    output_format=output_format,
                    bitrate=bitrate
                )
                
                # 显示输出统计
                if output_files:
                    total_size = sum(os.path.getsize(f) for f in output_files if os.path.exists(f))
                    size_mb = total_size / (1024 * 1024)
                    self.update_status("音频分割完成", 95, 
                                     f"音频分割完成，生成了 {len(output_files)} 个文件，总大小 {size_mb:.2f} MB")
                else:
                    self.update_status("未生成分割文件", 95, "警告: 未生成任何分割文件")
                
                # 保存结果
                self.output_files = output_files
                self.segments = filtered_segments
                
                # 完成处理
                total_time = time.time() - self.start_time
                if total_time > 60:
                    time_desc = f"{total_time/60:.1f} 分钟"
                else:
                    time_desc = f"{int(total_time)} 秒"
                    
                self.update_status(f"处理完成！总用时 {time_desc}", 100, 
                                  f"全部处理完成！音频分割为 {len(output_files)} 个片段，总用时 {time_desc}")
                self.completed = True
                
                # 清理内存
                if self.analyzer and torch.cuda.is_available():
                    del self.analyzer
                    torch.cuda.empty_cache()
                
            except Exception as e:
                self.error = str(e)
                logger.error(f"处理任务失败: {str(e)}")
                logger.error(traceback.format_exc())
                self.update_status("处理失败", 0, f"错误: {str(e)}")
                
        except Exception as e:
            self.error = str(e)
            logger.error(f"处理任务失败: {str(e)}")
            logger.error(traceback.format_exc())
            self.update_status("处理失败", 0, f"错误: {str(e)}")

# API 路由
@app.route('/api/status', methods=['GET'])
def get_status():
    """获取服务器状态"""
    # 更新 GPU 信息
    state.update_gpu_info()
    return jsonify({
        "status": "online",
        "gpu_info": state.gpu_info,
        "version": "1.0.0"
    })

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """上传文件并开始处理"""
    try:
        # 检查是否有文件上传
        if 'file' not in request.files:
            return jsonify({"error": "没有文件上传"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "没有选择文件"}), 400
        
        # 获取请求参数
        data = json.loads(request.form.get('data', '{}'))
        
        model_name = data.get('model', 'whisper-tiny')
        min_interval = float(data.get('minInterval', 1.0))
        max_interval = float(data.get('maxInterval', 5.0))
        preserve_sentences = data.get('preserveSentences', True)
        keywords = data.get('keywords', '')
        audio_format = data.get('audioFormat', 'mp3')
        file_prefix = data.get('prefix', 'segment')
        
        # 保存文件到临时目录
        temp_dir = tempfile.mkdtemp()
        filename = secure_filename(file.filename)
        file_path = os.path.join(temp_dir, filename)
        file.save(file_path)
        
        # 创建输出目录
        current_time = time.strftime("%Y%m%d_%H%M%S")
        output_dir = os.path.join(state.output_dir, f"{os.path.splitext(filename)[0]}_{current_time}")
        os.makedirs(output_dir, exist_ok=True)
        
        # 准备输出设置
        output_settings = {
            'format': audio_format,
            'prefix': file_prefix,
            'bitrate': '192k',
            'output_dir': output_dir,
            'use_disk_processing': True,
            'chunk_size_mb': 200,
            'max_workers': 2
        }
        
        # 创建处理任务ID
        task_id = f"task_{int(time.time())}_{os.path.splitext(filename)[0]}"
        
        # 创建和启动处理任务
        task = ProcessingTask(
            task_id=task_id,
            audio_path=file_path,
            model_name=model_name,
            min_interval=min_interval,
            max_interval=max_interval,
            preserve_sentences=preserve_sentences,
            keywords=keywords,
            output_settings=output_settings,
            language="zh"  # 固定使用中文
        )
        
        # 将任务添加到全局状态
        state.processing_tasks[task_id] = task
        
        # 启动任务
        task.start()
        
        return jsonify({
            "task_id": task_id,
            "status": "started",
            "message": "文件上传成功，开始处理"
        })
        
    except Exception as e:
        logger.error(f"上传处理失败: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@app.route('/api/tasks/<task_id>', methods=['GET'])
def get_task_status(task_id):
    """获取处理任务状态"""
    if task_id not in state.processing_tasks:
        return jsonify({"error": "任务不存在"}), 404
    
    task = state.processing_tasks[task_id]
    
    response = {
        "task_id": task_id,
        "status": task.status,
        "progress": task.progress,
        "detailed_status": task.detailed_status,
        "completed": task.completed,
        "error": task.error
    }
    
    # 如果任务已完成，添加结果信息
    if task.completed:
        output_files_info = []
        for file_path in task.output_files:
            if os.path.exists(file_path):
                size = os.path.getsize(file_path)
                output_files_info.append({
                    "path": file_path,
                    "name": os.path.basename(file_path),
                    "size": size,
                    "size_readable": f"{size/1024/1024:.2f} MB" if size > 1024*1024 else f"{size/1024:.2f} KB"
                })
        
        response["result"] = {
            "output_files": output_files_info,
            "segments_count": len(task.segments),
            "total_duration": sum(seg['end'] - seg['start'] for seg in task.segments) if task.segments else 0,
            "output_dir": task.output_settings.get('output_dir')
        }
    
    return jsonify(response)

@app.route('/api/download/<task_id>/<file_index>', methods=['GET'])
def download_file(task_id, file_index):
    """下载处理结果文件"""
    if task_id not in state.processing_tasks:
        return jsonify({"error": "任务不存在"}), 404
    
    task = state.processing_tasks[task_id]
    
    if not task.completed:
        return jsonify({"error": "任务尚未完成"}), 400
    
    try:
        file_index = int(file_index)
        if file_index < 0 or file_index >= len(task.output_files):
            return jsonify({"error": "文件索引无效"}), 400
        
        file_path = task.output_files[file_index]
        
        if not os.path.exists(file_path):
            return jsonify({"error": "文件不存在"}), 404
        
        return send_file(file_path, as_attachment=True)
    
    except Exception as e:
        logger.error(f"下载文件失败: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/batch', methods=['POST'])
def start_batch_processing():
    """批量处理上传的多个文件或指定目录内的文件"""
    try:
        # 检查是否为基于目录的批量处理
        content_type = request.headers.get('Content-Type', '')
        if content_type == 'application/json':
            data = request.json
            if not data:
                return jsonify({"error": "未提供请求数据"}), 400
            
            # 检查是否提供了路径
            if 'path' not in data:
                return jsonify({"error": "未提供目录路径"}), 400
            
            directory_path = data.get('path')
            output_dir = data.get('output_dir')
            params = data.get('params', {})
            
            # 验证路径
            if not os.path.exists(directory_path):
                return jsonify({"error": "指定的目录不存在"}), 400
            
            if not os.path.isdir(directory_path):
                return jsonify({"error": "指定的路径不是目录"}), 400
            
            # 获取处理参数
            model_name = params.get('model', 'whisper-tiny')
            min_interval = float(params.get('minInterval', 1.0))
            max_interval = float(params.get('maxInterval', 5.0))
            preserve_sentences = params.get('preserveSentences', True)
            keywords = params.get('keywords', '')
            audio_format = params.get('audioFormat', 'mp3')
            file_prefix = params.get('prefix', 'segment')
            
            # 创建批量任务ID
            batch_id = f"batch_{int(time.time())}"
            
            # 创建输出目录
            current_time = time.strftime("%Y%m%d_%H%M%S")
            if output_dir:
                batch_output_dir = output_dir
            else:
                batch_output_dir = os.path.join(state.output_dir, f"批量处理_{current_time}")
            os.makedirs(batch_output_dir, exist_ok=True)
            
            task_ids = []
            
            # 查找目录中的音频和视频文件
            supported_extensions = [
                '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a',  # 音频格式
                '.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm'  # 视频格式
            ]
            
            for item in os.listdir(directory_path):
                file_path = os.path.join(directory_path, item)
                if os.path.isfile(file_path):
                    file_ext = os.path.splitext(file_path)[1].lower()
                    if file_ext in supported_extensions:
                        # 创建文件特定的输出目录
                        file_output_dir = os.path.join(batch_output_dir, os.path.splitext(item)[0])
                        os.makedirs(file_output_dir, exist_ok=True)
                        
                        # 准备输出设置
                        output_settings = {
                            'format': audio_format,
                            'prefix': file_prefix,
                            'bitrate': '192k',
                            'output_dir': file_output_dir,
                            'use_disk_processing': True,
                            'chunk_size_mb': 200,
                            'max_workers': 2
                        }
                        
                        # 创建处理任务ID
                        task_id = f"{batch_id}_{os.path.splitext(item)[0]}"
                        
                        # 创建和启动处理任务
                        task = ProcessingTask(
                            task_id=task_id,
                            audio_path=file_path,
                            model_name=model_name,
                            min_interval=min_interval,
                            max_interval=max_interval,
                            preserve_sentences=preserve_sentences,
                            keywords=keywords,
                            output_settings=output_settings,
                            language="zh"  # 固定使用中文
                        )
                        
                        # 将任务添加到全局状态
                        state.processing_tasks[task_id] = task
                        task_ids.append(task_id)
                        
                        # 启动任务
                        task.start()
            
            if not task_ids:
                return jsonify({"error": "在指定目录中未找到支持的音频或视频文件"}), 400
            
            return jsonify({
                "batch_id": batch_id,
                "task_ids": task_ids,
                "task_count": len(task_ids),
                "status": "started",
                "message": "批量处理已开始"
            })
            
        # 传统的基于文件上传的批量处理
        elif 'files[]' in request.files:
            files = request.files.getlist('files[]')
            if not files or files[0].filename == '':
                return jsonify({"error": "没有选择文件"}), 400
            
            # 获取请求参数
            data = json.loads(request.form.get('data', '{}'))
            
            model_name = data.get('model', 'whisper-tiny')
            min_interval = float(data.get('minInterval', 1.0))
            max_interval = float(data.get('maxInterval', 5.0))
            preserve_sentences = data.get('preserveSentences', True)
            keywords = data.get('keywords', '')
            audio_format = data.get('audioFormat', 'mp3')
            file_prefix = data.get('prefix', 'segment')
            
            # 创建批量任务ID
            batch_id = f"batch_{int(time.time())}"
            
            # 创建输出目录
            current_time = time.strftime("%Y%m%d_%H%M%S")
            batch_output_dir = os.path.join(state.output_dir, f"批量处理_{current_time}")
            os.makedirs(batch_output_dir, exist_ok=True)
            
            task_ids = []
            
            # 处理每个文件
            for file in files:
                # 创建临时目录
                temp_dir = tempfile.mkdtemp()
                filename = secure_filename(file.filename)
                file_path = os.path.join(temp_dir, filename)
                file.save(file_path)
                
                # 创建文件特定的输出目录
                file_output_dir = os.path.join(batch_output_dir, os.path.splitext(filename)[0])
                os.makedirs(file_output_dir, exist_ok=True)
                
                # 准备输出设置
                output_settings = {
                    'format': audio_format,
                    'prefix': file_prefix,
                    'bitrate': '192k',
                    'output_dir': file_output_dir,
                    'use_disk_processing': True,
                    'chunk_size_mb': 200,
                    'max_workers': 2
                }
                
                # 创建处理任务ID
                task_id = f"{batch_id}_{os.path.splitext(filename)[0]}"
                
                # 创建和启动处理任务
                task = ProcessingTask(
                    task_id=task_id,
                    audio_path=file_path,
                    model_name=model_name,
                    min_interval=min_interval,
                    max_interval=max_interval,
                    preserve_sentences=preserve_sentences,
                    keywords=keywords,
                    output_settings=output_settings,
                    language="zh"  # 固定使用中文
                )
                
                # 将任务添加到全局状态
                state.processing_tasks[task_id] = task
                task_ids.append(task_id)
                
                # 启动任务
                task.start()
            
            return jsonify({
                "batch_id": batch_id,
                "task_ids": task_ids,
                "task_count": len(task_ids),
                "status": "started",
                "message": "批量处理已开始"
            })
        
        else:
            return jsonify({"error": "未提供文件或目录路径"}), 400
        
    except Exception as e:
        logger.error(f"批量处理失败: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@app.route('/api/batch/<batch_id>', methods=['GET'])
def get_batch_status(batch_id):
    """获取批量处理状态"""
    # 找出属于该批次的所有任务
    batch_tasks = {task_id: task for task_id, task in state.processing_tasks.items() 
                   if task_id.startswith(batch_id)}
    
    if not batch_tasks:
        return jsonify({"error": "批量任务不存在"}), 404
    
    # 计算总体进度
    total_progress = sum(task.progress for task in batch_tasks.values()) / len(batch_tasks)
    completed_tasks = sum(1 for task in batch_tasks.values() if task.completed)
    
    response = {
        "batch_id": batch_id,
        "task_count": len(batch_tasks),
        "completed_count": completed_tasks,
        "total_progress": round(total_progress, 1),
        "tasks": {}
    }
    
    # 添加各任务状态
    for task_id, task in batch_tasks.items():
        response["tasks"][task_id] = {
            "status": task.status,
            "progress": task.progress,
            "detailed_status": task.detailed_status,
            "completed": task.completed,
            "error": task.error
        }
    
    # 添加总体状态
    if completed_tasks == len(batch_tasks):
        response["status"] = "completed"
    elif any(task.error for task in batch_tasks.values()):
        response["status"] = "error"
    else:
        response["status"] = "processing"
    
    return jsonify(response)

@app.route('/api/set_output_dir', methods=['POST'])
def set_output_dir():
    """设置输出目录"""
    try:
        data = request.json
        
        # 检查是否使用默认路径
        use_default = data.get('useDefault', False)
        is_batch = data.get('isBatch', False)
        
        if use_default:
            # 使用默认路径（用户Downloads文件夹下的'音频处理结果'目录）
            default_path = os.path.join(os.path.expanduser("~"), "Downloads", "音频处理结果")
            if is_batch:
                default_path = os.path.join(default_path, "批量处理")
            
            # 确保目录存在
            os.makedirs(default_path, exist_ok=True)
            
            # 更新全局状态
            state.output_dir = default_path
            logger.info(f"设置输出目录为默认路径: {default_path}")
            
            return jsonify({
                "success": True, 
                "path": default_path,
                "isBatch": is_batch,
                "isDefault": True
            })
        
        # 非默认路径处理
        if not data or 'path' not in data:
            return jsonify({"success": False, "error": "未提供路径"}), 400
        
        # 获取路径并进行标准化
        path = data.get('path')
        
        # 验证路径
        try:
            # 路径规范化
            normalized_path = os.path.normpath(path)
            # 检查路径是否是绝对路径
            if not os.path.isabs(normalized_path):
                return jsonify({"success": False, "error": "请提供绝对路径"}), 400
            
            # 检查驱动器是否有效（Windows系统）
            if os.name == 'nt' and not os.path.exists(os.path.splitdrive(normalized_path)[0] + '\\'):
                return jsonify({"success": False, "error": "无效的驱动器"}), 400
            
            # 尝试创建目录
            os.makedirs(normalized_path, exist_ok=True)
            
            # 检查写入权限
            test_file = os.path.join(normalized_path, '.write_test')
            try:
                with open(test_file, 'w') as f:
                    f.write('test')
                os.remove(test_file)
            except (IOError, PermissionError):
                return jsonify({"success": False, "error": "无法写入该目录，请检查权限"}), 400
            
            # 更新全局状态
            state.output_dir = normalized_path
            logger.info(f"设置输出目录为: {normalized_path}")
            
            return jsonify({
                "success": True, 
                "path": normalized_path,
                "isBatch": is_batch
            })
        
        except Exception as e:
            logger.error(f"设置输出目录失败: {str(e)}")
            return jsonify({"success": False, "error": f"设置输出目录失败: {str(e)}"}), 500
    except Exception as e:
        logger.error(f"设置输出目录失败: {str(e)}")
        return jsonify({"success": False, "error": f"设置输出目录失败: {str(e)}"}), 500

@app.route('/api/get_default_output_dir', methods=['GET'])
def get_default_output_dir():
    """获取默认输出目录"""
    try:
        is_batch = request.args.get('isBatch', 'false').lower() == 'true'
        
        # 获取当前设置的输出目录
        current_path = state.output_dir
        
        # 如果是批量处理目录，在当前目录基础上添加"批量处理"子目录
        if is_batch:
            batch_path = os.path.join(current_path, "批量处理")
            # 确保目录存在
            os.makedirs(batch_path, exist_ok=True)
            return jsonify({"success": True, "path": batch_path, "isBatch": True})
        
        return jsonify({"success": True, "path": current_path})
    
    except Exception as e:
        logger.error(f"获取默认输出目录失败: {str(e)}")
        return jsonify({"success": False, "error": f"获取默认输出目录失败: {str(e)}"}), 500

@app.route('/api/list_directory', methods=['POST'])
def list_directory():
    """列出目录内容"""
    try:
        data = request.json
        if not data or 'path' not in data:
            return jsonify({"success": False, "error": "未提供路径"}), 400
        
        # 获取路径并进行标准化
        path = data.get('path')
        
        # 验证路径
        try:
            # 路径规范化
            normalized_path = os.path.normpath(path)
            # 检查路径是否是绝对路径
            if not os.path.isabs(normalized_path):
                return jsonify({"success": False, "error": "请提供绝对路径"}), 400
            
            # 检查驱动器是否有效（Windows系统）
            if os.name == 'nt' and not os.path.exists(os.path.splitdrive(normalized_path)[0] + '\\'):
                return jsonify({"success": False, "error": "无效的驱动器"}), 400
            
            # 检查目录是否存在
            if not os.path.exists(normalized_path):
                return jsonify({"success": False, "error": "指定的目录不存在"}), 400
            
            if not os.path.isdir(normalized_path):
                return jsonify({"success": False, "error": "指定的路径不是目录"}), 400
            
            # 获取文件列表
            file_list = []
            for item in os.listdir(normalized_path):
                item_path = os.path.join(normalized_path, item)
                if os.path.isfile(item_path):
                    # 获取文件信息
                    file_size = os.path.getsize(item_path)
                    file_ext = os.path.splitext(item)[1].lower()
                    
                    # 检查是否为支持的音频/视频文件
                    is_supported = file_ext in [
                        '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a',  # 音频格式
                        '.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm'  # 视频格式
                    ]
                    
                    if is_supported:
                        file_list.append({
                            "name": item,
                            "path": item_path,
                            "size": file_size,
                            "size_readable": f"{file_size/1024/1024:.2f} MB" if file_size > 1024*1024 else f"{file_size/1024:.2f} KB"
                        })
            
            return jsonify({
                "success": True,
                "path": normalized_path,
                "files": file_list,
                "count": len(file_list)
            })
        
        except Exception as e:
            logger.error(f"列出目录内容失败: {str(e)}")
            return jsonify({"success": False, "error": f"列出目录内容失败: {str(e)}"}), 500
    
    except Exception as e:
        logger.error(f"列出目录内容失败: {str(e)}")
        return jsonify({"success": False, "error": f"列出目录内容失败: {str(e)}"}), 500

@app.route('/api/process_file', methods=['POST'])
def process_file():
    """处理指定路径的文件"""
    try:
        data = request.json
        if not data or 'file_path' not in data:
            return jsonify({"error": "未提供文件路径"}), 400
        
        file_path = data.get('file_path')
        
        # 验证路径
        if not os.path.exists(file_path):
            return jsonify({"error": "文件不存在"}), 400
        
        if not os.path.isfile(file_path):
            return jsonify({"error": "指定的路径不是文件"}), 400
        
        # 获取处理参数
        model_name = data.get('model', 'whisper-tiny')
        min_interval = float(data.get('minInterval', 1.0))
        max_interval = float(data.get('maxInterval', 5.0))
        preserve_sentences = data.get('preserveSentences', True)
        keywords = data.get('keywords', '')
        audio_format = data.get('audioFormat', 'mp3')
        file_prefix = data.get('prefix', 'segment')
        
        # 创建输出目录
        current_time = time.strftime("%Y%m%d_%H%M%S")
        filename = os.path.basename(file_path)
        output_dir = os.path.join(state.output_dir, f"{os.path.splitext(filename)[0]}_{current_time}")
        os.makedirs(output_dir, exist_ok=True)
        
        # 准备输出设置
        output_settings = {
            'format': audio_format,
            'prefix': file_prefix,
            'bitrate': '192k',
            'output_dir': output_dir,
            'use_disk_processing': True,
            'chunk_size_mb': 200,
            'max_workers': 2
        }
        
        # 创建处理任务ID
        task_id = f"task_{int(time.time())}_{os.path.splitext(filename)[0]}"
        
        # 创建和启动处理任务
        task = ProcessingTask(
            task_id=task_id,
            audio_path=file_path,
            model_name=model_name,
            min_interval=min_interval,
            max_interval=max_interval,
            preserve_sentences=preserve_sentences,
            keywords=keywords,
            output_settings=output_settings,
            language="zh"  # 固定使用中文
        )
        
        # 将任务添加到全局状态
        state.processing_tasks[task_id] = task
        
        # 启动任务
        task.start()
        
        return jsonify({
            "task_id": task_id,
            "status": "started",
            "message": "开始处理文件"
        })
        
    except Exception as e:
        logger.error(f"处理文件失败: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # 设置服务器端口
    port = int(os.environ.get('PORT', 9000))
    
    print(f"启动AI音频处理服务于 http://localhost:{port}")
    print(f"当前输出目录: {state.output_dir}")
    
    if state.gpu_info["available"]:
        print(f"GPU: {state.gpu_info['device_name']}")
        print(f"GPU内存: {state.gpu_info['total_memory']} MB")
    else:
        print("警告: 未检测到可用GPU，处理速度可能较慢")
    
    # 启动服务器
    app.run(host='0.0.0.0', port=port, debug=False) 