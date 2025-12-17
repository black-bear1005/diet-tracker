import React, { useState } from 'react';
import { login, register } from '../services/bmob';
import { User, Lock, Mail } from 'lucide-react';

interface AuthProps {
  onSuccess: () => void;
}

const Auth: React.FC<AuthProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password, email.trim() || undefined);
      }
      onSuccess();
    } catch (e: any) {
      setError(e?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 transform transition-all">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            {mode === 'login' ? '欢迎回来' : '创建账号'}
          </h2>
          <p className="text-gray-500">
            {mode === 'login' ? '开启今天的健康生活' : '开始您的健康之旅'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="用户名"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border-transparent focus:border-blue-500 focus:bg-white border rounded-xl focus:ring-0 transition-all duration-200 outline-none"
              />
            </div>
          </div>
          
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border-transparent focus:border-blue-500 focus:bg-white border rounded-xl focus:ring-0 transition-all duration-200 outline-none"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="邮箱（可选）"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border-transparent focus:border-blue-500 focus:bg-white border rounded-xl focus:ring-0 transition-all duration-200 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 space-y-4">
          <button
            onClick={submit}
            disabled={loading || !username || !password}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold rounded-full py-3 shadow-lg transform transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '处理中...' : (mode === 'login' ? '立即登录' : '立即注册')}
          </button>
          
          <div className="text-center">
            <button
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              {mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;

