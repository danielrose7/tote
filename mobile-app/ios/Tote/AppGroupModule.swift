import Foundation
import React
import Security

@objc(AppGroupModule)
class AppGroupModule: NSObject {
  private let pendingUrlsKey = "pendingUrls"
  private let pendingUrlDebugKey = "pendingUrlDebug"
  private let collectionsKey = "captureCollections"
  private let pendingCapturesKey = "pendingCaptures"
  private let keychainService = "tote-api-key"
  private let keychainAccount = "share-extension"
  private let keychainAccessGroup = "group.tools.tote.app"

  private func sharedDefaults() -> UserDefaults? {
    guard let appGroup = Bundle.main.object(forInfoDictionaryKey: "AppGroup") as? String else {
      return nil
    }
    return UserDefaults(suiteName: appGroup)
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  // MARK: - Pending URLs (legacy plain-URL queue)

  @objc(getPendingUrls:rejecter:)
  func getPendingUrls(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let defaults = sharedDefaults() else {
      resolve([])
      return
    }

    let urls = defaults.stringArray(forKey: pendingUrlsKey) ?? []
    let normalizedUrls = urls
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
    let uniqueUrls = Array(NSOrderedSet(array: normalizedUrls)) as? [String] ?? []

    if uniqueUrls != urls {
      defaults.set(uniqueUrls, forKey: pendingUrlsKey)
      defaults.synchronize()
    }

    resolve(uniqueUrls)
  }

  @objc
  func clearPendingUrls() {
    sharedDefaults()?.removeObject(forKey: pendingUrlsKey)
  }

  // MARK: - Debug events

  @objc(getPendingUrlDebugEvents:rejecter:)
  func getPendingUrlDebugEvents(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let defaults = sharedDefaults() else {
      resolve([])
      return
    }
    resolve(defaults.stringArray(forKey: pendingUrlDebugKey) ?? [])
  }

  @objc
  func clearPendingUrlDebugEvents() {
    sharedDefaults()?.removeObject(forKey: pendingUrlDebugKey)
  }

  // MARK: - Structured captures (extension picked a collection)

  @objc(enqueuePendingCapture:)
  func enqueuePendingCapture(_ json: String) {
    guard let defaults = sharedDefaults(), !json.isEmpty else { return }
    var captures = defaults.stringArray(forKey: pendingCapturesKey) ?? []
    captures.append(json)
    defaults.set(captures, forKey: pendingCapturesKey)
    defaults.synchronize()
  }

  @objc(getPendingCaptures:rejecter:)
  func getPendingCaptures(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    let captures = sharedDefaults()?.stringArray(forKey: pendingCapturesKey) ?? []
    resolve(captures)
  }

  @objc
  func clearPendingCaptures() {
    sharedDefaults()?.removeObject(forKey: pendingCapturesKey)
  }

  // MARK: - Collections cache (written by main app, read by share extension)

  @objc(setCollectionsCache:)
  func setCollectionsCache(_ json: String) {
    sharedDefaults()?.set(json, forKey: collectionsKey)
    sharedDefaults()?.synchronize()
  }

  @objc(getCollectionsCache:rejecter:)
  func getCollectionsCache(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    let json = sharedDefaults()?.string(forKey: collectionsKey)
    resolve(json)
  }

  // MARK: - API key (stored in shared Keychain, read by share extension)

  @objc(setApiKey:)
  func setApiKey(_ secret: String) {
    guard let data = secret.data(using: .utf8) else { return }

    let deleteQuery: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: keychainService,
      kSecAttrAccount as String: keychainAccount,
      kSecAttrAccessGroup as String: keychainAccessGroup,
    ]
    SecItemDelete(deleteQuery as CFDictionary)

    let addQuery: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: keychainService,
      kSecAttrAccount as String: keychainAccount,
      kSecAttrAccessGroup as String: keychainAccessGroup,
      kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
    ]
    SecItemAdd(addQuery as CFDictionary, nil)
  }

  @objc(getApiKey:rejecter:)
  func getApiKey(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: keychainService,
      kSecAttrAccount as String: keychainAccount,
      kSecAttrAccessGroup as String: keychainAccessGroup,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]

    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)

    if status == errSecSuccess, let data = item as? Data,
       let secret = String(data: data, encoding: .utf8) {
      resolve(secret)
    } else {
      resolve(nil)
    }
  }

  // MARK: - Close share extension

  @objc
  func close() {
    NotificationCenter.default.post(name: NSNotification.Name("close"), object: nil)
  }
}
