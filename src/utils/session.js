const USER_STORAGE_KEY = 'user';
const ACTIVE_USER_KEY = 'activeUserSessionKey';
const USER_STORAGE_PREFIX = 'persistedUser:';
const SESSION_EVENT_NAME = 'user-session-changed';

function safeParseUser(value) {
    if (!value) return null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function buildUserStorageKey(user) {
    return `${USER_STORAGE_PREFIX}${user.id}`;
}

function persistUser(user) {
    const storageKey = buildUserStorageKey(user);
    localStorage.setItem(storageKey, JSON.stringify(user));
    return storageKey;
}

function setActiveUserStorageKey(storageKey) {
    sessionStorage.setItem(ACTIVE_USER_KEY, storageKey);
}

function emitSessionChange() {
    window.dispatchEvent(new Event(SESSION_EVENT_NAME));
}

function clearLegacyStorage() {
    sessionStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
}

function migrateLegacyUser() {
    const legacySessionUser = safeParseUser(sessionStorage.getItem(USER_STORAGE_KEY));
    if (legacySessionUser) {
        const storageKey = persistUser(legacySessionUser);
        setActiveUserStorageKey(storageKey);
        clearLegacyStorage();
        return legacySessionUser;
    }

    const legacyLocalUser = safeParseUser(localStorage.getItem(USER_STORAGE_KEY));
    if (legacyLocalUser) {
        const storageKey = persistUser(legacyLocalUser);
        setActiveUserStorageKey(storageKey);
        clearLegacyStorage();
        return legacyLocalUser;
    }

    return null;
}

export function getStoredUser() {
    const activeStorageKey = sessionStorage.getItem(ACTIVE_USER_KEY);
    if (activeStorageKey) {
        const activeUser = safeParseUser(localStorage.getItem(activeStorageKey));
        if (activeUser) {
            return activeUser;
        }
        sessionStorage.removeItem(ACTIVE_USER_KEY);
    }

    return migrateLegacyUser();
}

export function getStoredUsers() {
    return Object.keys(localStorage)
        .filter((key) => key.startsWith(USER_STORAGE_PREFIX))
        .map((storageKey) => {
            const user = safeParseUser(localStorage.getItem(storageKey));
            return user ? { ...user, storageKey } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.username.localeCompare(b.username));
}

export function setStoredUser(user) {
    const storageKey = persistUser(user);
    setActiveUserStorageKey(storageKey);
    clearLegacyStorage();
    emitSessionChange();
}

export function restoreStoredUser(storageKey) {
    const user = safeParseUser(localStorage.getItem(storageKey));
    if (!user) {
        return null;
    }

    setActiveUserStorageKey(storageKey);
    emitSessionChange();
    return user;
}

export function removeStoredUser(storageKey) {
    localStorage.removeItem(storageKey);
    if (sessionStorage.getItem(ACTIVE_USER_KEY) === storageKey) {
        sessionStorage.removeItem(ACTIVE_USER_KEY);
    }
    emitSessionChange();
}

export function clearStoredUser() {
    const activeStorageKey = sessionStorage.getItem(ACTIVE_USER_KEY);
    if (activeStorageKey) {
        localStorage.removeItem(activeStorageKey);
    }

    sessionStorage.removeItem(ACTIVE_USER_KEY);
    clearLegacyStorage();
    emitSessionChange();
}

export function getSessionEventName() {
    return SESSION_EVENT_NAME;
}
