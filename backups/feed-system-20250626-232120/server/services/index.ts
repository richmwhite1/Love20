export { BaseService } from './base-service';
export { UserService } from './user-service';
export { PostService } from './post-service';
export { ListService } from './list-service';
export { NotificationService } from './notification-service';
export { PrivacyService } from './privacy-service';
export { AuditService } from './audit-service';

// Create service instances
import { UserService } from './user-service';
import { PostService } from './post-service';
import { ListService } from './list-service';
import { NotificationService } from './notification-service';
import { PrivacyService } from './privacy-service';
import { AuditService } from './audit-service';

export const userService = new UserService();
export const postService = new PostService();
export const listService = new ListService();
export const notificationService = new NotificationService();
export const privacyService = new PrivacyService();
export const auditService = new AuditService();
