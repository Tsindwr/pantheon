import { useEffect, useState } from 'react';

export function useQueryParam(name: string) {
    const [value, setValue] = useState<string | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        setValue(params.get(name));
        setReady(true);
    }, [name]);

    return { value, ready };
}