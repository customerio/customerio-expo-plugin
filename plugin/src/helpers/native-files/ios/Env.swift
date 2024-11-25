import Foundation
import CioTracking

class Env {
    static var customerIOSiteId: String = "{{SITE_ID}}"
    static var customerIOApiKey: String = "{{API_KEY}}"
    static var customerIORegion: Region = {{REGION}} // "us" or "eu"
}