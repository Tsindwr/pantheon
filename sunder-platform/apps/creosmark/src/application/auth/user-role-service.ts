/**
 * Read-only role access contract.
 *
 * A user role can affect presentation, but this service
 * does not grant database permissions or authorize mutations.
 */
export type UserRoleRepository = {
    isAdmin(userId: string): Promise<boolean>;
};

export function createUserRoleService(repository: UserRoleRepository) {
    return {
        async isAdmin(userId: string | null | undefined): Promise<boolean> {
            if (!userId) return false;

            return repository.isAdmin(userId);
        },
    };
}