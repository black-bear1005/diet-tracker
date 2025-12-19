import React, { useState, useEffect } from 'react';
import { getAllVersions, releaseNewVersion, uploadFile, AppVersion } from '../../services/bmob';
import { uploadToGithub, getGithubConfig, saveGithubConfig, GithubConfig } from '../../services/github';
import { Box, Upload, CheckCircle, AlertTriangle, Settings, Github } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { format } from 'date-fns';

const AdminVersions = () => {
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Github Config State
  const [showGithubConfig, setShowGithubConfig] = useState(false);
  const [githubConfig, setGithubConfig] = useState<GithubConfig>({
      token: '',
      owner: '',
      repo: '',
      branch: 'main',
      path: 'releases'
  });

  // New Version Form
  const [newVersion, setNewVersion] = useState<Partial<AppVersion>>({
    version: '',
    updateContent: '',
    forceUpdate: false,
    platform: 'android'
  });
  const [manualUrl, setManualUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const data = await getAllVersions();
      setVersions(data);
    } catch (error) {
      console.error('Failed to fetch versions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
    const saved = getGithubConfig();
    if (saved) setGithubConfig(saved);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSaveConfig = () => {
      saveGithubConfig(githubConfig);
      setShowGithubConfig(false);
      alert('配置已保存');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!file && !manualUrl) || !newVersion.version || !newVersion.updateContent) {
        alert('请填写完整信息，并选择上传文件或填写下载链接');
        return;
    }

    setUploading(true);
    try {
      let url = manualUrl;

      // 1. Upload APK/WGT if file selected
      if (file) {
          try {
              // Try Bmob first (will likely fail if no domain)
              // But if user has configured GitHub, we prefer GitHub? 
              // Or fallback logic? Let's try fallback.
              // Actually, if Bmob fails, the error message is usually about domain.
              
              if (githubConfig.token && githubConfig.repo) {
                  console.log('Using GitHub Storage...');
                  url = await uploadToGithub(file, githubConfig);
              } else {
                  console.log('Using Bmob Storage...');
                  url = await uploadFile(file);
              }
          } catch (uploadError: any) {
              console.warn('Upload failed:', uploadError);
              
              // If failed and no github config, prompt user
              if (!githubConfig.token) {
                 const useGithub = confirm(`Bmob 上传失败（可能因未备案域名）。\n是否尝试配置 GitHub 仓库作为免费存储？\n\n点击[确定]去配置 GitHub，点击[取消]使用手动链接。`);
                 if (useGithub) {
                     setShowGithubConfig(true);
                     setUploading(false);
                     return;
                 }
              }
              
              if (manualUrl) {
                  alert('上传失败，将使用您填写的外部链接。');
                  url = manualUrl;
              } else {
                  throw new Error('上传失败：' + uploadError.message);
              }
          }
      }
      
      if (!url) {
          throw new Error('无效的下载链接');
      }

      // 2. Create Version Record
      await releaseNewVersion({
          ...newVersion,
          downloadUrl: url
      } as AppVersion);

      setIsAddModalOpen(false);
      setNewVersion({ version: '', updateContent: '', forceUpdate: false, platform: 'android' });
      setFile(null);
      setManualUrl('');
      fetchVersions();
      alert('发布成功');
    } catch (error: any) {
      console.error(error);
      alert('发布失败: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">版本管理</h2>
        <div className="flex gap-2">
            <button 
                onClick={() => setShowGithubConfig(true)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                title="存储设置"
            >
                <Settings size={20} />
            </button>
            <button 
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
                <Upload size={20} />
                发布新版本
            </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">版本号</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">平台</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">更新内容</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">强制更新</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">发布时间</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">下载链接</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {loading ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">加载中...</td></tr>
                ) : versions.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">暂无版本历史</td></tr>
                ) : (
                    versions.map(v => (
                        <tr key={v.objectId} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-mono font-medium text-blue-600">{v.version}</td>
                            <td className="px-6 py-4">
                                {v.platform === 'android' ? '🤖 Android' : '🍎 iOS'}
                            </td>
                            <td className="px-6 py-4 max-w-xs truncate" title={v.updateContent}>
                                {v.updateContent}
                            </td>
                            <td className="px-6 py-4">
                                {v.forceUpdate ? (
                                    <span className="text-red-500 flex items-center gap-1 text-xs font-bold bg-red-50 px-2 py-1 rounded w-fit">
                                        <AlertTriangle size={12} /> 是
                                    </span>
                                ) : (
                                    <span className="text-slate-400 text-xs">否</span>
                                )}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500">
                                {v.createdAt ? format(new Date(v.createdAt), 'yyyy-MM-dd HH:mm') : '-'}
                            </td>
                            <td className="px-6 py-4">
                                <a href={v.downloadUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm">
                                    下载
                                </a>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
      </div>

      {/* Github Config Modal */}
      <AnimatePresence>
        {showGithubConfig && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowGithubConfig(false)}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                />
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-xl"
                >
                    <div className="flex items-center gap-3 mb-4 text-slate-800">
                        <Github size={28} />
                        <h3 className="text-xl font-bold">GitHub 免费存储配置</h3>
                    </div>
                    <p className="text-sm text-slate-500 mb-6">
                        配置 GitHub 仓库后，上传的文件将自动存储到 GitHub，并通过 jsDelivr 全球 CDN 加速下载。完全免费，无需域名备案。
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Personal Access Token</label>
                            <input 
                                type="password" 
                                value={githubConfig.token}
                                onChange={e => setGithubConfig({...githubConfig, token: e.target.value})}
                                placeholder="ghp_xxxxxxxxxxxx"
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm"
                            />
                            <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-1 block">
                                点击获取 Token (需勾选 repo 权限)
                            </a>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Owner (用户名)</label>
                                <input 
                                    type="text" 
                                    value={githubConfig.owner}
                                    onChange={e => setGithubConfig({...githubConfig, owner: e.target.value})}
                                    placeholder="e.g. yourname"
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Repo (仓库名)</label>
                                <input 
                                    type="text" 
                                    value={githubConfig.repo}
                                    onChange={e => setGithubConfig({...githubConfig, repo: e.target.value})}
                                    placeholder="e.g. my-app-files"
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-8">
                        <button 
                            onClick={() => setShowGithubConfig(false)}
                            className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                            取消
                        </button>
                        <button 
                            onClick={handleSaveConfig}
                            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            保存配置
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* Upload Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => !uploading && setIsAddModalOpen(false)}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                />
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="relative bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl"
                >
                    <h3 className="text-xl font-bold mb-4">发布新版本</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">版本号 (e.g. 1.0.0)</label>
                                <input 
                                    type="text" 
                                    required
                                    value={newVersion.version}
                                    onChange={e => setNewVersion({...newVersion, version: e.target.value})}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">平台</label>
                                <select
                                    value={newVersion.platform}
                                    onChange={e => setNewVersion({...newVersion, platform: e.target.value as 'android' | 'ios'})}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                >
                                    <option value="android">Android</option>
                                    <option value="ios">iOS</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">更新内容</label>
                            <textarea 
                                required
                                rows={4}
                                value={newVersion.updateContent}
                                onChange={e => setNewVersion({...newVersion, updateContent: e.target.value})}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                                placeholder="请输入更新日志..."
                            />
                        </div>

                        {/* File Upload OR URL Input */}
                        <div className="space-y-4 border-t border-slate-100 pt-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">方式一：上传安装包 (APK/WGT)</label>
                                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => document.getElementById('version-file')?.click()}>
                                    {file ? (
                                        <div className="flex items-center justify-center gap-2 text-green-600">
                                            <CheckCircle size={20} />
                                            <span className="font-medium">{file.name}</span>
                                            <span className="text-xs text-slate-400">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                        </div>
                                    ) : (
                                        <div className="text-slate-400">
                                            <Box className="mx-auto mb-2" size={32} />
                                            <p>点击选择文件 (需配置 Bmob 域名)</p>
                                        </div>
                                    )}
                                </div>
                                <input 
                                    id="version-file"
                                    type="file" 
                                    hidden 
                                    onChange={handleFileChange}
                                    accept=".apk,.wgt,.ipa"
                                />
                            </div>

                            <div className="relative flex py-1 items-center">
                                <div className="flex-grow border-t border-slate-200"></div>
                                <span className="flex-shrink-0 mx-4 text-slate-400 text-xs">或者</span>
                                <div className="flex-grow border-t border-slate-200"></div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">方式二：手动填写下载链接</label>
                                <input 
                                    type="url" 
                                    value={manualUrl}
                                    onChange={e => setManualUrl(e.target.value)}
                                    placeholder="https://example.com/app.apk"
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                                <p className="text-xs text-slate-400 mt-1">
                                    如果您没有 Bmob 域名，请将文件上传到 GitHub/网盘/局域网服务器，并在此粘贴链接。
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox"
                                id="forceUpdate"
                                checked={newVersion.forceUpdate}
                                onChange={e => setNewVersion({...newVersion, forceUpdate: e.target.checked})}
                                className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="forceUpdate" className="text-sm text-slate-700">强制更新 (用户必须更新才能使用)</label>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button 
                                type="button"
                                disabled={uploading}
                                onClick={() => setIsAddModalOpen(false)}
                                className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                            >
                                取消
                            </button>
                            <button 
                                type="submit"
                                disabled={uploading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {uploading ? '发布中...' : '确认发布'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminVersions;
