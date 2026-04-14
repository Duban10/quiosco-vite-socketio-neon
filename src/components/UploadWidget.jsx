import React, { useEffect, useRef } from 'react';

const UploadWidget = ({ children, onUpload }) => {
    const cloudinaryRef = useRef();
    const widgetRef = useRef();
    const onUploadRef = useRef(onUpload);

    useEffect(() => {
        onUploadRef.current = onUpload;
    }, [onUpload]);

    useEffect(() => {
        cloudinaryRef.current = window.cloudinary;
        if (!cloudinaryRef.current) return;

        widgetRef.current = cloudinaryRef.current.createUploadWidget({
            cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
            uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
        }, function(error, result) {
            if (!error && result && result.event === "success") {
                onUploadRef.current?.(result.info.secure_url);
            }
        });

        return () => {
            if (widgetRef.current?.destroy) {
                widgetRef.current.destroy();
            }
        };
    }, []);

    return (
        <>
            {children({ open: () => widgetRef.current.open() })}
        </>
    );
};

export default UploadWidget;
