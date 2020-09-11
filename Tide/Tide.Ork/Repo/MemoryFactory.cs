﻿using Microsoft.Extensions.Caching.Memory;
using Tide.Core;

namespace Tide.Ork.Repo {
    public class MemoryFactory : IKeyManagerFactory {
        private static readonly ICmkManager _manager = new MemoryCmkManager();
        private static readonly ICvkManager _managerCvk = new MemoryCvkManager();
        private static readonly IKeyIdManager _keyIdManager = new MemoryKeyIdManager();
        private static readonly IRuleManager _memoryRuleManager = new MemoryRuleManager();
        private readonly IMemoryCache _cache;

        public MemoryFactory(IMemoryCache cache)
        {
            _cache = cache;
        }

        public ICmkManager BuildCmkManager() => new CacheCmkManager(_cache, _manager);

        public ICvkManager BuildManagerCvk() => new CacheCvkManager(_cache, _managerCvk);

        public IKeyIdManager BuildKeyIdManager() => _keyIdManager;

        public IRuleManager BuildRuleManager() => new CacheRuleManager(_cache, _memoryRuleManager);
    }
}